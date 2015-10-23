#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var split = require('split');
var through2 = require('through2');
var concat = require('concat-stream');
var sprintf = require('sprintf');
var table = require('text-table');
var pdfkit = require('pdfkit');


var argv = require('minimist')(process.argv.slice(2), {
    alias: {
        r: 'rcpt',
        e: 'expense',
        v: 'verbose',
        i: 'interactive',
        m: 'mode',
        o: 'output'
    }
});
var outfile = argv.o;
var mode = argv.mode || /\.pdf$/.test(outfile) || 'text';

if (mode === 'pdf' && !argv.rcpt) return usage(1)
if (argv.h || argv.help) return usage(0);

var configDir = argv.c || path.join(
    process.env.HOME || process.env.USERDIR, '.config', 'invoicer'
);
mkdirp.sync(configDir);

var configFile = argv.c || path.join(configDir, 'config.json');
if (!fs.existsSync(configFile)) {
    if (!process.stdin.isTTY && !argv.i) {
        console.error('configuration file not found');
        return process.exit(1);
    }
    return prompter(function (err, cfg) {
        if (err) return console.error(err);
        writeConfig(cfg);
        readJSON(cfg);
    });
}
else readJSON(require(configFile));

function readJSON (cfg) {
    if (argv.e) {
        var expenses = require(path.resolve(argv.e));
        return withConfig(require(configFile), expenses);
    }
    
    process.stdin.pipe(concat(function (body) {
        var expenses = JSON.parse(body);
        withConfig(require(configFile), expenses);
    }));
}

function withConfig (cfg, expenses) {
    if (cfg.id === undefined) cfg.id = 1;
    if (mode === 'text') {
        var hours = expenses[0].hours.map(function (row) {
            return [ row.date, row.hours ];
        });
        var total = expenses[0].hours.reduce(function (sum, row) {
            return sum + row.hours;
        }, 0);
        var totals = [
            [ '-----------', '-----' ],
            [ 'total hours', round(total, 100) ],
            [ 'hourly rate', expenses[0].rate ],
            [ 'total', round(total * expenses[0].rate, 100) ]
        ];
        console.log(table(
            [
                [ 'date', 'hours' ],
                [ '----', '-----' ]
            ].concat(hours).concat(totals),
            { align: [ 'l', 'l', 'l' ] }
        ));
        return;
    }
    
    var doc = new pdfkit();
    doc.pipe(fs.createWriteStream(outfile));

    doc.font('Times-Roman', 12)

    doc.text('Invoice ID: ', { continued: true })
      .fillColor('#666')
      .text(sprintf('%05d', cfg.id ++)).fillColor('black');

    doc.text('Date: ', { continued: true })
      .fillColor('#666')
      .text(new Date().toJSON().slice(0,10));

    doc.moveDown().text(cfg.name);
    doc.text(cfg.address, { continued: true})
        .text(cfg.email, { align: 'right'});

    doc.moveDown().fillColor('black').text('Invoice To:');

    doc.fillColor('#666').text(argv.rcpt).moveDown(2);

    doc.fillColor('black').text('Expenses:');
    doc.text('________________________________');

    var opts = { width: 180, continued: true, lineGap: 6 };

    expenses.forEach(function (row) {
        if (row.rate && row.hours) {
            doc.fillColor('black').text(row.title, { lineGap: 6 })
                .fillColor('#666');
            row.hours.forEach(function (r) {
                doc.text(r.date, opts)
                    .text(r.hours + 'h * ' + row.rate, { align: 'right' });
            });
        }
        if (row.items) {
            var title = row.title || 'expenses';
            doc.fillColor('black').moveDown().text(title, {lineGap: 6})
                .fillColor('#666');

            row.items.forEach(function (r) {
                doc.text(r.title, opts).text(r.amount, { align: 'right' });
            });
        }
        if (row.amount) {
            doc.fillColor('black').moveDown().text(row.title, opts)
                .fillColor('#666')
                .text(row.amount, { align: 'right' });
        }
    });

    (function () {
        var hours = 0;
        expenses.forEach(function (row) {
            (row.hours || []).forEach(function (r) {
                hours += r.hours;
            });
        });
        hours = round(hours, 100);
        
        var rates = Object.keys(expenses.reduce(function (acc, row) {
            if (row.rate) acc[row.rate] = true;
            return acc;
        }, {}));

        var amount = round(expenses.reduce(function (acc, row) {
            if (row.hours) {
                acc += row.rate * row.hours.reduce(function (h, r) {
                    return h + r.hours;
                }, 0)
            }
            if (row.items) {
                row.items.forEach(function (r) {
                    acc += r.amount || 0;
                });
            }
            if (row.amount) {
                acc += row.amount;
            }
            return acc;
        }, 0), 100) + ' ' + cfg.currency;
        
        doc.fillColor('black').text('________________________________');

        doc.text('Total Hours', opts).text(hours, { align: 'right' });
        doc.text('Hourly Rate', opts)
            .text(rates.join(',') + ' ' + cfg.currency, { align: 'right' });
        doc.text('Total (USD)', opts).text(amount, { align: 'right' });

        doc.fillColor('black').moveUp()
            .text('________________________________');
    })();

    doc.end();
    
    writeConfig(cfg);
}

function writeConfig (cfg) {
    fs.writeFileSync(configFile, JSON.stringify(cfg, null, 2));
}

function prompter (cb) {
    var fields = [ 'name', 'address', 'email', 'currency' ];
    var cfg = {};
    console.log('Gathering configuration options.');
    console.log('Use \\n to denote line-breaks.');
    
    var field = fields.shift();
    process.stdout.write('  ' + field + '> ');
    process.stdin.pipe(split()).pipe(through2(function (line, enc, next) {
        cfg[field] = line.toString('utf8').replace(/\\n/g, '\n');
        
        if (fields.length === 0) {
            cb(null, cfg);
            process.stdin.end();
        }
        else {
            field = fields.shift();
            process.stdout.write('  ' + field + '> ');
            next();
        }
    }));
}

function usage (code) {
    var rs = fs.createReadStream(__dirname + '/usage.txt');
    rs.pipe(process.stdout);
    
    rs.on('close', function () {
        if (code !== 0) process.exit(code);
    });
}

function round (n, ths) {
    return Math.round(n * ths) / ths;
}
