const cheerio = require('cheerio')
const util = require('./util.js')

const CACHE_TIME = 1 * 60 * 60 * 1000 // 1hour
//const CACHE_TIME = 1 * 60 * 1000 // 1min
const PATH = 'data/covid19fukui/'
const URL = 'https://www.pref.fukui.lg.jp/doc/kenkou/kansensyo-yobousessyu/corona.html'

const getCovid19Data = async function(cachetime) {
  return await util.getWebWithCache(URL, PATH, cachetime)
}
const getLastUpdate = function(fn) {
  return util.getLastUpdateOfCache(URL, PATH)
}
const startUpdate = function() {
  setInterval(async function() {
    await util.getWebWithCache(URL, PATH, CACHE_TIME)
  }, CACHE_TIME)
}

const parseWeek = function(s) {
  s = util.toHalf(s)
  const n = s.indexOf('週')
  return s.substring(0, n)
}
// '令和２年３月９日午前９時時点' -> 2020/03/09 09:00
const parseDate = function(s) {
  s = util.toHalf(s)
  const num = s.match(/令和(\d+)年(\d+)月(\d+)日午(前|後)(\d+)時時点/)
  //console.log(s, num)
  const y = parseInt(num[1]) + 2018
  const m = num[2]
  const d = num[3]
  const h = parseInt(num[5]) + (num[4] == '後' ? 12 : 0)
  const fix0 = util.fix0
  return y + "/" + fix0(m, 2) + "/" + fix0(d, 2) + " " + fix0(h, 2) + ":00"
}
const getCovid19DataJSON = async function(cachetime) {
  const data = await getCovid19Data(cachetime)
  const dom = cheerio.load(data)
  const weeks = []
  /*
  dom('tr').each((idx, ele) => {
    const td = dom(ele).children()
    if (!flg) {
      for (let i = 0; i < td.length; i++) {
        const d = td[i]
        const text = d.children[0].data
//        console.log(i, d.name, d.type, text)
        //if (text == '累計検査件数') {
        if (text && text.indexOf('（参考）検査実施状況') >= 0) {
          flg = true
          console.log("****")
        }
      }
    } else {
      const week = td[0].children[0].data // ８週（令和２年２月17日～23日）
      const ninspect = td[1].children[0].data // 検査件数
      const npatient = td[3].children[0].data // 陽性患者数
      if (week == '計') {
        flg = false
      } else {
        weeks.push({ 'week': parseWeek(week), 'ninspect': util.cutNoneN(ninspect), 'npatient': util.cutNoneN(npatient) })
      }
    }
  })
  */
 let state = 0
 const res = { 'inspection': weeks }
  dom('p').each((idx, ele) => {
    if (state == 0) {
      if (ele.children.length) {
        const text = ele.children[0].data
        if (text && text.indexOf('（参考）検査実施状況') >= 0) {
          res.lastUpdate = parseDate(text.substring(text.indexOf('　') + 1))
          state = 1
        }
      }
    } else if (state == 1) {
      if (ele.children.length) {
        const tbl = dom(ele).next()
        dom(tbl).find('tr').each((idx, ele) => {
          const td = dom(ele).children()
          const week = td[0].children[0].data // ８週（令和２年２月17日～23日）
          const ninspect = td[1].children[0].data // 検査件数
          const npatient = td[3].children[0].data // 陽性患者数
          if (week != "週" && week != '計') {
            weeks.push({ 'week': parseWeek(week), 'ninspect': util.cutNoneN(ninspect), 'npatient': util.cutNoneN(npatient) })
          }
        })
        state = 2
      }
    }
    /*
    } else {
      console.log(tbl.data)
      //dom('tr').each((idx, ele) => {
      */
  })
  res.summary = calcCovid19DataSummary(res)
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
    'n_inspections': calcSum(json.inspection, 'ninspect'),
    'n_patients': calcSum(json.inspection, 'npatient'),
    'n_light': 1,
    'n_heavy': 0,
    'n_exit': 0,
    'n_death': 0,
    'n_capacity_pcr_per_day': 66, // https://www.pref.fukui.lg.jp/doc/kenkou/kansensyo-yobousessyu/corona_d/fil/200319-1.pdf
    'n_capacity_bed': 48,
    's_lastUpdate': json.lastUpdate,
  }
}
const getCovid19DataSummaryForIchigoJam = async function() {
  const json = await getCovid19DataJSON()
  return util.simplejson2txt(json.summary)
}

const main = async function() {
  const data = await getCovid19DataJSON(1000 * 60)
  console.log(data)
  //console.log(await getCovid19DataSummaryForIchigoJam())
}
if (require.main === module) {
  main()
} else {
  startUpdate()
}

exports.getCovid19DataJSON = getCovid19DataJSON
exports.getCovid19DataSummaryForIchigoJam = getCovid19DataSummaryForIchigoJam
