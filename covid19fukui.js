const http = require('http')
const fs = require('fs')
const cheerio = require('cheerio')
const fetch = require('node-fetch')

const simplejson2txt = function(json) {
  const res = []
  for (const name in json) {
    res.push(name)
    res.push(json[name])
  }
  res.splice(0, 0, res.length / 2)
  res.push('')
  return res.join('\r\n')
}
const fix0 = function(n, beam) {
  const s = "000000000" + n
  return s.substring(s.length - beam)
}
const getYMDH = function() {
  const t = new Date()
  return t.getFullYear() + fix0(t.getMonth() + 1, 2) + fix0(t.getDate(), 2) + fix0(t.getHours(), 2)
}
const getYMD = function() {
  const t = new Date()
  return t.getFullYear() + fix0(t.getMonth() + 1, 2) + fix0(t.getDate(), 2)
}

//
const getCovid19FukuiData = async function() {
  const fn = 'data/covid19fukui/' + getYMD() + ".html"
  try {
    return fs.readFileSync(fn, 'utf-8')
  } catch (e) {
    const URL = 'https://www.pref.fukui.lg.jp/doc/kenkou/kansensyo-yobousessyu/bukan-haien.html'
    const html = await (await fetch(URL)).text()
    fs.writeFileSync(fn, html)
    console.log("write", fn)
    return html
  }
}
const cutNoneN = function(s) {
  s = toHalf(s)
  return parseInt(s.replace(/[^\d]/g, ""))
}
const toHalf = function(s) {
  const ZEN = "０１２３４５６７８９（）"
  const HAN = "0123456789()"
  let s2 = ""
  for (let i = 0; i < s.length; i++) {
    const c = s.charAt(i)
    const n = ZEN.indexOf(c)
    if (n >= 0) {
      s2 += HAN.charAt(n)
    } else {
      s2 += c
    }
  }
  return s2
}
const parseWeek = function(s) {
  s = toHalf(s)
  const n = s.indexOf('週')
  return s.substring(0, n)
}
// '令和２年３月９日午前９時時点' -> 2020/03/09 09:00
const parseDate = function(s) {
  s = toHalf(s)
  const num = s.match(/令和(\d+)年(\d+)月(\d+)日午(前|後)(\d+)時時点/)
  //console.log(s, num)
  const y = parseInt(num[1]) + 2018
  const m = num[2]
  const d = num[3]
  const h = parseInt(num[5]) + (num[4] == '後' ? 12 : 0)
  return y + "/" + fix0(m, 2) + "/" + fix0(d, 2) + " " + fix0(h, 2) + ":00"
}
const getCovid19FukuiDataWeekly = async function() {
  const data = await getCovid19FukuiData()
  const dom = cheerio.load(data)
  const weeks = []
  let flg = false
  dom('tr').each((idx, ele) => {
    const td = dom(ele).children()
    if (!flg) {
      for (let i = 0; i < td.length; i++) {
        const d = td[i]
        const text = d.children[0].data
//        console.log(i, d.name, d.type, text)
        if (text == '累計検査件数') {
          flg = true
        }
      }
    } else {
      const week = td[0].children[0].data // ８週（令和２年２月17日～23日）
      const ninspect = td[1].children[0].data // 検査件数
      const npatient = td[3].children[0].data // 陽性患者数
      if (week == '計') {
        flg = false
      } else {
        weeks.push({ 'week': parseWeek(week), 'ninspect': cutNoneN(ninspect), 'npatient': cutNoneN(npatient) })
      }
    }
  })
  const res = { 'inspection': weeks }
  dom('p').each((idx, ele) => {
    if (ele.children.length) {
      const text = ele.children[0].data
      //console.log(text)
      if (text && text.indexOf('（参考）検査実施状況') >= 0) {
        res.lastUpdate = parseDate(text.substring(text.indexOf('　') + 1))
      }
    }
  })
  return res
}
const getCovid19FukuiDataSummary = async function() {
  const json = await getCovid19FukuiDataWeekly()
  //const calcSum = (data, name) => data.reduce((acc, val) => acc + data[name], 0)
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
    'n_light': 0,
    'n_heavy': 0,
    'n_exit': 0,
    'n_death': 0,
    's_lastUpdate': json.lastUpdate,
  }
}
const getCovid19FukuiDataSummaryForIchigoJam = async function() {
  const json = await getCovid19FukuiDataSummary()
  return simplejson2txt(json)
}

const startUpdate = function() {
  console.log("start update covid19fukui")
  setInterval(function() {
    getCovid19FukuiData()
  }, 1 * 60 * 60 * 1000) // 1hour
}

const main = async function() {
  const data = await getCovid19FukuiDataWeekly()
  //console.log(data)
  console.log(await getCovid19FukuiDataSummary())
}
//main()

startUpdate()

exports.getCovid19FukuiDataWeekly = getCovid19FukuiDataWeekly
exports.getCovid19FukuiDataSummaryForIchigoJam = getCovid19FukuiDataSummaryForIchigoJam
exports.getCovid19FukuiDataSummary = getCovid19FukuiDataSummary
