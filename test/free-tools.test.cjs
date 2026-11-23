const test = require('node:test');
const assert = require('node:assert/strict');
global.window = {};
const bsr = require('../narzedzia/bsr.js');
const {estimate} = require('../narzedzia/royalty.js');
const {dimensions} = require('../narzedzia/cover.js');
const catalog = require('../narzedzia/category-data.json');

test('measured BSR examples preserve the published monthly values', () => {
  for (const [market,rank,monthly] of [
    ['com',32598,300], ['com',50000,210], ['com',80000,120], ['co.uk',50000,24],
    ['de',50000,29], ['it',50000,15], ['fr',50000,8], ['es',50000,7],
    ['ca',50000,13], ['com.au',50000,3]
  ]) assert.deepEqual(bsr.estimate(bsr.samplesByMarket[market],rank),{monthly,exact:true});
  assert.equal(bsr.estimate(bsr.samplesByMarket.com,51500).exact,false);
  assert.equal(bsr.estimate(bsr.samplesByMarket.it,1),null);
});

test('standard color paperback distinguishes KDP and Titans estimates', () => {
  const book = {format:'soft',market:'us',ink:'standard',size:1,pages:140,price:14.99,sold:1};
  const result = estimate(book);
  assert.equal(result.cost,6.63);
  assert.equal(result.royalty,2.36);
  assert.equal(result.reference,2.11);
});

test('US black-and-white paperback crosses the royalty threshold at $9.99', () => {
  const book = {format:'soft',market:'us',ink:'black',size:0,pages:300,price:9.98,sold:1};
  assert.equal(estimate(book).royalty,.39);
  assert.equal(estimate({...book, price:9.99}).royalty,1.39);
});

test('6 by 9 paperback cover includes the spine and bleed', () => {
  const cover = dimensions('soft','6x9','white',120);
  assert.ok(Math.abs(cover.spine-.27024)<1e-8);
  assert.ok(Math.abs(cover.width-12.52024)<1e-8);
  assert.equal(cover.height,9.25);
});

test('US book category samples retain their Amazon node IDs', () => {
  for (const [id,name] of [['15756641','Sudoku'],['4455','Word Search'],['107142011','Electrical Systems']]) {
    assert.ok(catalog.categories.some(([key,path])=>key===id && path.endsWith(' › '+name)));
  }
});
