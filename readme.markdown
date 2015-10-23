# invoicer

generate PDF invoices from json

# example

``` json
[
  {"title":"consulting","rate": 100, "hours":[
    {"date":"2075-08-27","hours":2.5},
    {"date":"2075-08-28","hours":7},
    {"date":"2075-09-01","hours":5.5}
  ]},
  {"title":"travel","items":[
    {"title":"airfare","amount":750},
    {"title":"hotel","amount":240}
  ]},
  {"title":"hosting","amount":40}
]
```

``` bash
$ invoicer -r 'BEEPCORP HOLDINGS LTD' -e expenses.json -o invoice.pdf
```

The first time you run invoicer you will be prompted to enter your name,
address, email, and currency.

Once invoicer finishes you will have a fancy `invoice.pdf`.

_How_ fancy an invoice? Glad you asked:

![Screenshot of PDF invoice](images/invoice.png)

# usage

```
usage: invoicer -r 'BEEPCORP HOLDINGS LTD' -e expenses.json -o invoice.pdf

  -r, --rcpt      invoice receipient
  -e, --expenses  expense sheet. If not given or '-', read from stdin.
  -o, --output    generate a pdf for this filename
  -m, --mode      mode to use (implied by the extension in -o, otherwise "text")
  -c FILE         config file (default: ~/.config/invoicer/config.json)            

Here is an example expenses.json file:

  [
    {"title":"consulting","rate": 100, "hours":[
      {"date":"2075-08-27","hours":2.5},
      {"date":"2075-08-28","hours":7},
      {"date":"2075-09-01","hours":5.5}
    ]},
    {"title":"travel","items":[
      {"title":"airfare","amount":750},
      {"title":"hotel","amount":240}
    ]},
    {"title":"hosting","amount":40}
  ]

For each `row` in the json array, `invoicer` only looks for:

* `row.rate` and a `row.hours` array
* `row.items` array
* `row.amount`

Each row should have a title.
```

# install

install with [npm](https://npmjs.org) to get
the `invoicer` command:

```
npm install -g invoicer
```

# license

MIT
