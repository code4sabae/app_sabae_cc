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
const formatYMDHMS = function(t) {
  return t.getFullYear() + "-" + fix0(t.getMonth() + 1, 2) + "-" + fix0(t.getDate(), 2) + "T" + fix0(t.getHours(), 2) + ":" + fix0(t.getMinutes(), 2) + ":" + fix0(t.getSeconds(), 2)
}
const getYMDHMS = function() {
  const t = new Date()
  return t.getFullYear() + fix0(t.getMonth() + 1, 2) + fix0(t.getDate(), 2) + fix0(t.getHours(), 2) + fix0(t.getMinutes(), 2) + fix0(t.getSeconds(), 2)
}
const getYMDHM = function() {
  const t = new Date()
  return t.getFullYear() + fix0(t.getMonth() + 1, 2) + fix0(t.getDate(), 2) + fix0(t.getHours(), 2) + fix0(t.getMinutes(), 2)
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
const mkdirSyncForFile = function(fn) {
  const dirs = fn.split('/')
  let dir = ""
  for (let i = 0; i < dirs.length - 1; i++) {
    dir += dirs[i] + "/"
    try {
      fs.mkdirSync(dir, 0744)
    } catch (e) {
    }
  }
}
const getExtFromURL = function(url) {
  let ext = ".txt"
  const n = url.lastIndexOf('/')
  const webfn = url.substring(n)
  const m = webfn.lastIndexOf('.')
  if (m >= 0) {
    ext = webfn.substring(m)
  }
  return ext
}
const getWebWithCache = async function(url, path, cachetime) {
  const ext = getExtFromURL(url)
  const fnlatest = path + "_latest" + ext
  const fn = path + getYMDHMS() + ext
  let cache = null
  try {
    const modtime = fs.statSync(fnlatest).mtime
    const dt = new Date().getTime() - new Date(modtime).getTime()
    //console.log(dt, new Date(modtime).getTime(), new Date().getTime())
    cache = fs.readFileSync(fnlatest, 'utf-8')
    if (dt < CACHE_TIME) {
      //console.log("use cache")
      return cache
    }
  } catch (e) {
  }
  const data = await (await fetch(url)).text()
  if (data == cache) {
    //console.log("same as cache")
    return cache
  }
  try {
    fs.writeFileSync(fnlatest, data)
    fs.writeFileSync(fn, data)
  } catch (e) {
    mkdirSyncForFile(fn)
    fs.writeFileSync(fnlatest, data)
    fs.writeFileSync(fn, data)
  }
  //console.log("write", fn)
  return data
}

// util
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

// custom

const CACHE_TIME = 1 * 60 * 60 * 1000 // 1hour
//const CACHE_TIME = 1 * 60 * 1000 // 1min

const getCovid19Data = async function() {
  const path = 'data/covid19ishikawa/'
  const URL = 'https://www.pref.ishikawa.lg.jp/kansen/coronakennai.html'
  return await getWebWithCache(URL, path, CACHE_TIME)
}
const getLastUpdate = function(fn) {
  const path = 'data/covid19ishikawa/'
  const URL = 'https://www.pref.ishikawa.lg.jp/kansen/coronakennai.html'
  const fnlatest = path + "_latest" + getExtFromURL(URL)
  try {
    const modtime = fs.statSync(fnlatest).mtime
    const d = new Date(modtime)
    return formatYMDHMS(d)
  } catch (e) {
  }
  return null
}
const startUpdate = function() {
  console.log("start update covid19ishikawa")
  setInterval(function() {
    getCovid19Data()
  }, CACHE_TIME)
}
// 令和2年2月27日（県内5例目） -> 2020/02/27 1
// 令和2年2月24日（県内3例目、4例目）） -> 2020/02/24 2
const parseDate = function(s) {
  const num = s.match(/令和(\d+)年(\d+)月(\d+)日.+/)
  //console.log(s, num)
  const y = 2018 + parseInt(num[1])
  const m = parseInt(num[2])
  const d = parseInt(num[3])
  return y + "-" + fix0(m, 2) + "-" + fix0(d, 2)
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
    //console.log(ele)
    const text = ele.children[0].data
    const d = parseData(text)
    if (d)
      daily.push(d)
    //console.log(text)
  })
  //console.log(daily)
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
  return simplejson2txt(json.summary)
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
