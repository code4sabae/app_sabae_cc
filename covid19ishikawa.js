const cheerio = require('cheerio')
const util = require('./util.js')

const CACHE_TIME = 1 * 60 * 60 * 1000 // 1hour
//const CACHE_TIME = 1 * 60 * 1000 // 1min
const PATH = 'data/covid19ishikawa/'
const URL = 'https://www.pref.ishikawa.lg.jp/kansen/coronakennai.html'

const getCovid19Data = async function() {
  return await util.getWebWithCache(URL, PATH)
}
const getLastUpdate = function(fn) {
  return util.getLastUpdateOfCache(URL, PATH)
}
const startUpdate = function() {
  setInterval(async function() {
    await util.getWebWithCache(URL, PATH, CACHE_TIME)
  }, CACHE_TIME)
}

// 令和2年2月27日（県内5例目） -> 2020/02/27 1
// 令和2年2月24日（県内3例目、4例目）） -> 2020/02/24 2
const parseDate = function(s) {
  const num = s.match(/令和(\d+)年(\d+)月(\d+)日.+/)
  const y = 2018 + parseInt(num[1])
  const m = parseInt(num[2])
  const d = parseInt(num[3])
  return y + "-" + util.fix0(m, 2) + "-" + util.fix0(d, 2)
}
const parseData = function(s) {
  if (s == null)
    return null
  let cnt = 0
  let idx = 0
  for (let idx = 0;;) {
    const n = s.indexOf('例目', idx)
    if (n < 0)
      break
    cnt++
    idx = n + 2
  }
  if (!cnt)
    return null
  return { date: parseDate(s), npatients: cnt }
}
const getCovid19DataJSON = async function() {
  const data = await getCovid19Data()
  const dom = cheerio.load(data)
  const daily = []
  dom('h2').each((idx, ele) => {
    const text = ele.children[0].data
    const d = parseData(text)
    if (d)
      daily.push(d)
  })
  const res = { npatients: daily }
  res.summary = calcCovid19DataSummary(res)
  res.lastUpdate = getLastUpdate()
  return res
}
const calcCovid19DataSummary = function(json) {
  const calcSum = function(data, name) {
    let sum = 0
    for (let i = 0; i < data.length; i++) {
      sum += data[i][name]
    }
    return sum
  }
  return {
    //'ninspections': calcSum(json.inspections, 'ninspections'),
    'npatients': calcSum(json.npatients, 'npatients'),
    //'ncontacts': calcSum(json.inqueries, 'ncontacts'),
    //'nquerents': calcSum(json.inqueries, 'nquerents'),
    //'n_light': 0,
    //'n_heavy': 0,
    //'n_exit': 0,
    //'n_death': 0,
    //'s_lastUpdate': json.lastUpdate,
  }
}
const getCovid19DataSummaryForIchigoJam = async function() {
  const json = await getCovid19DataJSON()
  return util.simplejson2txt(json.summary)
}

const main = async function() {
  //const org = await getCovid19Data()
  //console.log(org)
  
  const data = await getCovid19DataJSON()
  console.log(data)
  console.log(await getCovid19DataSummaryForIchigoJam())
}
if (require.main === module) {
  main()
} else {
  startUpdate()
}

exports.getCovid19DataJSON = getCovid19DataJSON
exports.getCovid19DataSummaryForIchigoJam = getCovid19DataSummaryForIchigoJam
