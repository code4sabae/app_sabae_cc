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
const getCovid19Data = async function() {
  const path = 'data/covid19tokushima/'
  const fn = path + getYMDH() + ".html"
  try {
    return fs.readFileSync(fn, 'utf-8')
  } catch (e) {
    const URL = 'https://www.pref.tokushima.lg.jp/ippannokata/kenko/kansensho/5034012'
    const html = await (await fetch(URL)).text()
    try {
      fs.writeFileSync(fn, html)
    } catch (e) {
      fs.mkdirSync('data', 0744)
      fs.mkdirSync(path, 0744)
      fs.writeFileSync(fn, html)
    }
    //console.log("write", fn)
    return html
  }
}
const cutNoneN = function(s) {
  s = toHalf(s)
  const n = parseInt(s.replace(/[^\d]/g, ""))
  if (isNaN(n))
    return 0
  return n
}
const toHalf = function(s) {
  const ZEN = "０１２３４５６７８９（）／"
  const HAN = "0123456789()/"
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
// '1/30～3/3 -> 2020-01-30/2020-03-03  3月4日（水） -> 2020/03/04
const parseDate = function(s) {
  s = toHalf(s)
  if (s.indexOf('～') >= 0) {
    const num = s.match(/(\d+)\/(\d+)～(\d+)\/(\d+)/)
    //console.log(s, num)
    const y = 2020
    const m1 = num[1]
    const d1 = num[2]
    const m2 = num[2]
    const d2 = num[3]
    return y + "-" + fix0(m1, 2) + "-" + fix0(d1, 2) + "/" + y + "-" + fix0(m2, 2) + "-" + fix0(d2, 2)
  }
  const num = s.match(/(\d+)月(\d+)日.+/)
  //console.log(s, num)
  const y = 2020
  const m = num[1]
  const d = num[2]
  return y + "-" + fix0(m, 2) + "-" + fix0(d, 2)
}
const getCovid19DataDaily = async function() {
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
        if (text.trim() == '帰国者・接触者相談センター') {
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
        weeks.push({ 'date': parseDate(date), 'ncontacts': cutNoneN(general), 'nquerents': cutNoneN(touch) })
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
        inspects.push({ 'date': parseDate(date), 'ninspections': cutNoneN(ninspects), 'npatients': cutNoneN(npatients) })
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
    //'s_lastUpdate': json.lastUpdate,
  }
}
const getCovid19DataSummaryForIchigoJam = async function() {
  const json = await getCovid19DataDaily()
  return simplejson2txt(json.summary)
}

const startUpdate = function() {
  console.log("start update covid19tokushima")
  setInterval(function() {
    getCovid19Data()
  }, 1 * 60 * 60 * 1000) // 1hour
}

const main = async function() {
  const data = await getCovid19DataDaily()
  console.log(data)
  console.log(await getCovid19DataSummaryForIchigoJam())
}

if (require.main === module) {
  main()
} else {
  startUpdate()
}

exports.getCovid19DataDaily = getCovid19DataDaily
exports.getCovid19DataSummaryForIchigoJam = getCovid19DataSummaryForIchigoJam
