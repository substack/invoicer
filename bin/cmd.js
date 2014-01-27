#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var split = require('split');
var through2 = require('through2');
var sprintf = require('sprintf');
var spawn = require('child_process').spawn;
var os = require('os');

var argv = require('minimist')(process.argv.slice(2), {
    alias: { r: 'rcpt' }
});
var outfile = argv.o;

if (!outfile) return usage(1)
if (!argv.rcpt) return usage(1)
if (argv.h || argv.help) return usage(0);

var texsrc = fs.readFileSync(__dirname + '/invoice.tex', 'utf8');

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
    console.log(cfg);
    if (cfg.id === undefined) cfg.id = 1;
    
    var params = {
        id: sprintf('%05d', cfg.id ++),
        name: cfg.name,
        address: cfg.address.replace(/\n/g, ' \\\\\n'),
        rcpt: argv.rcpt
    };
    
    var output = texsrc.replace(
        /(?!\\)\${([^}]+)}/g,
        function (_, key) { return params[key] }
    );
    
    var tmpdir = path.join(os.tmpdir(), 'invoicer-' + Math.random();
    mkdirp.sync(tmpdir);
    fs.writeFileSync(path.join(tmpdir, 'invoice.tex'), output);
    
    var ps = spawn('pdflatex', [ 'invoice.tex' ], { cwd: tmpdir });
    var err = '';
    ps.stderr.on('data', function (buf) { err += buf });
    ps.on('exit', function (code) {
        if (code !== 0) return console.error(err);
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
    var fields = [ 'name', 'address', 'email' ];
    var cfg = {};
    console.log('Gathering configuration options.');
    console.log('Use \\n to denote line-breaks.');
    
    var field = fields.shift();
    process.stdout.write('  ' + field + '> ');
    process.stdin.pipe(split()).pipe(through2(function (line, enc, next) {
        cfg[field] = line.toString('utf8').replace(/\\n/g, '\n');
        
        if (fields.length === 0) return cb(null, cfg);
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
