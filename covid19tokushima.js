const cheerio = require('cheerio')
const util = require('./util.js')

const CACHE_TIME = 1 * 60 * 60 * 1000 // 1hour
//const CACHE_TIME = 1 * 60 * 1000 // 1min
const PATH = 'data/covid19tokushima/'
const URL = 'https://www.pref.tokushima.lg.jp/ippannokata/kenko/kansensho/5034012'

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

// '1/30～3/3 -> 2020-01-30/2020-03-03  3月4日（水） -> 2020/03/04
const parseDate = function(s) {
  const fix0 = util.fix0
  s = util.toHalf(s)
  if (s.indexOf('～') >= 0) {
    const num = s.match(/(\d+)\/(\d+)～(\d+)\/(\d+)/)
    //console.log(s, num)
    const y = 2020
    const m1 = num[1]
    const d1 = num[2]
    const m2 = num[3]
    const d2 = num[4]
    const res = y + "-" + fix0(m1, 2) + "-" + fix0(d1, 2) + "/" + y + "-" + fix0(m2, 2) + "-" + fix0(d2, 2)
    return res
  }
  const num = s.match(/(\d+)月(\d+)日.+/)
  //console.log(s, num)
  const y = 2020
  const m = num[1]
  const d = num[2]
  return y + "-" + fix0(m, 2) + "-" + fix0(d, 2)
}
const getCovid19DataJSON = async function() {
  const data = await getCovid19Data()
  const dom = cheerio.load(data)
  const weeks = []
  const inspects = []
  let state = 0
  dom('tr').each((idx, ele) => {
    const td = dom(ele).children()
    if (state == 0) {
      for (let i = 0; i < td.length; i++) {
        const d = td[i]
        const text = d.children[0].data
        //console.log(i, d.name, d.type, text)
        if (text.trim() == '帰国者・接触者相談センター（保健所）') {
          state = 1
        }
      }
    } else if (state == 1) {
      const date = td[0].children[0].data.trim()
      const general = td[1].children[0].data.trim()
      const touch = td[3].children[0].data.trim()
      if (date.trim() == '累計') {
        state = 2
      } else {
        weeks.push({ 'date': parseDate(date), 'ncontacts': util.cutNoneN(general), 'nquerents': util.cutNoneN(touch) })
      }
    } else if (state == 2) {
      for (let i = 0; i < td.length; i++) {
        const d = td[i]
        const text = d.children[0].data
        //console.log(i, d.name, d.type, text)
        if (text.trim() == '検査結果（陽性）') {
          state = 3
        }
      }
    } else if (state == 3) {
      const date = td[0].children[0].data.trim()
      const ninspects = td[1].children[0].data.trim()
      const npatients = td[3].children[0].data.trim()
      if (date.trim() == '累計') {
        state = 4
      } else {
        inspects.push({ 'date': parseDate(date), 'ninspections': util.cutNoneN(ninspects), 'npatients': util.cutNoneN(npatients) })
      }
    }
  })
  const res = { 'inqueries': weeks, 'inspections': inspects }
  res.summary = calcCovid19DataSummary(res)
  /*
  dom('p').each((idx, ele) => {
    if (ele.children.length) {
      const text = ele.children[0].data
      //console.log(text)
      if (text && text.indexOf('（参考）検査実施状況') >= 0) {
        res.lastUpdate = parseDate(text.substring(text.indexOf('　') + 1))
      }
    }
  })
  */
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
    'ninspections': calcSum(json.inspections, 'ninspections'),
    'npatients': calcSum(json.inspections, 'npatients'),
    'ngeneralcontacts': calcSum(json.inspections, 'npatients'),
    'ncontacts': calcSum(json.inqueries, 'ncontacts'),
    'nquerents': calcSum(json.inqueries, 'nquerents'),
    //'n_light': 0,
    //'n_heavy': 0,
    //'n_exit': 0,
    //'n_death': 0,
  }
}
const getCovid19DataSummaryForIchigoJam = async function() {
  const json = await getCovid19DataJSON()
  return util.simplejson2txt(json.summary)
}

const main = async function() {
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
