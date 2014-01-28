#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var split = require('split');
var through2 = require('through2');
var sprintf = require('sprintf');
var spawn = require('child_process').spawn;
var strftime = require('strftime');
var os = require('os');

var argv = require('minimist')(process.argv.slice(2), {
    alias: { r: 'rcpt', e: 'expense' }
});
var outfile = argv.o;

if (!outfile) return usage(1)
if (!argv.rcpt) return usage(1)
if (!argv.e) return usage(1)
if (argv.h || argv.help) return usage(0);

var texsrc = fs.readFileSync(__dirname + '/../invoice.tex', 'utf8');

var configDir = argv.c || path.join(
    process.env.HOME || process.env.USERDIR, '.config', 'invoicer'
);
mkdirp.sync(configDir);

var configFile = path.join(configDir, 'config.json');
if (!fs.existsSync(configFile)) {
    return prompter(function (err, cfg) {
        if (err) return console.error(err);
        writeConfig(cfg);
        withConfig(cfg);
    });
}
else withConfig(require(configFile))

function withConfig (cfg) {
    if (cfg.id === undefined) cfg.id = 1;
    
    var expenses = require(path.resolve(argv.e));
    var params = {
        id: sprintf('%05d', cfg.id ++),
        name: cfg.name,
        address: cfg.address.replace(/\n/g, ' \\\\\n'),
        email: cfg.email,
        rcpt: argv.rcpt,
        expenses: expenses.map(function (row) {
            if (row.type === 'hours') {
                var title = row.title || 'Consulting Hours';
                return '{\\bf Date} & {\\bf ' + title + '} \\\\\n'
                    + (row.hours || []).map(function (r) {
                        return strftime('%F', new Date(r.date))
                            + ' & ' + r.hours + ' \\\\\n'
                        ;
                    }).join('\n') + '\n'
                ;
            }
            return '';
        }),
        totals: (function () {
            var hours = expenses.reduce(function (acc, row) {
                if (row.type !== 'hours') return acc;
                return row.hours.reduce(function (h, r) {
                    return h + r.hours;
                }, acc);
            }, 0);
            
            var rates = Object.keys(expenses.reduce(function (acc, row) {
                if (row.type === 'hours') {
                    acc[row.rate] = true;
                }
                return acc;
            }, {}));
            
            var amount = expenses.reduce(function (acc, row) {
                if (row.type === 'hours') {
                    return row.rate * row.hours.reduce(function (h, r) {
                        return h + r.hours;
                    }, 0)
                }
                return acc;
            }, 0) + ' ' + cfg.currency;
            
            return [
                '{\\bf Total Hours} & {\\bf ' + hours + '}',
                '{\\bf Hourly Rate} & {\\bf '
                    + rates.join(',') + ' ' + cfg.currency + '}',
                '{\\bf Total (' + cfg.currency + ')} & {\\bf ' + amount + '}',
                '\\hline'
            ].join('\\\\\n') + '\n';
        })()
    };
    
    var output = texsrc.replace(
        /(?!\\)\${([^}]+)}/g,
        function (_, key) { return params[key] }
    );
    
    var tmpdir = path.join(os.tmpdir(), 'invoicer-' + Math.random());
    mkdirp.sync(tmpdir);
    fs.writeFileSync(path.join(tmpdir, 'invoice.tex'), output);
    
    var args = [ '-interaction=nonstopmode -halt-on-error', 'invoice.tex' ];
    var ps = spawn('pdflatex', args, { cwd: tmpdir });
    
    ps.stdout.pipe(process.stdout);
    ps.stderr.pipe(process.stderr);
    
    ps.on('exit', function (code) {
        if (code !== 0) return console.error('NONZERO EXIT CODE');
        fs.createReadStream(path.join(tmpdir, 'invoice.pdf'))
            .pipe(fs.createWriteStream(outfile))
        ;
    });
    
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
            return cb(null, cfg);
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
