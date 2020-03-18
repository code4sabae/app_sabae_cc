const fs = require('fs')
const fetch = require('node-fetch')
const cheerio = require('cheerio')
const util = require('./util.js')
const jimp = require("jimp")
const img2text = require('./img2text.js')

const PATH = 'data/covid19kyoto/'
const URL = 'https://www.pref.kyoto.jp/kentai/news/novelcoronavirus.html'
const BASEURL = 'https://www.pref.kyoto.jp'
const CACHE_TIME = 1 * 60 * 60 * 1000 // 1hour

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

const getCovid19DataJSON = async function(cachetime) {
  const data = await getCovid19Data(cachetime)
  const dom = cheerio.load(data)
  const weeks = []
  const res = {}
  let state = 0
  let url = null
  dom('img').each((idx, ele) => {
    const img = dom(ele)
    const text = img.attr("alt")
    if (text && text.startsWith("ＰＣＲ検査結果")) {
      url = img.attr("src")
    }
  })
  if (!url) {
    return null // err
  }
  if (url.indexOf(":") == -1) {
    url = BASEURL + url
  }
  const json = await getJSONbyImage(url)
  return json
}

const getCurrentPatients = async function(fn) {
  const jpg = await jimp.read(fn)
  const orgwidth = 690
  const crops = [
    //[ 'lastUpdate', 504, 38, 158, 22 ],
    [ 'ninspections', 24, 161, 90, 26 ],
    [ 'npatients', 218, 161, 62, 26 ],
    [ 'nnotpatients', 138, 161, 62, 26 ],
    /*
    [ 'nexits', 231, 126, 113, 30 ],
    [ 'ndeaths', 568, 138, 137, 32 ],
    [ 'ncurrentpatients', 390, 126, 136, 32 ],
    */
  ]
  const ratio = jpg.bitmap.width / orgwidth
  const reformatnum = function(s) {
    s = s.trim()
    if (s.length == 0)
      return "-"
    const n = parseInt(s)
    if (n == s)
      return n
    return "-"
  }
  const res = {}
  let ncnt = 0
  for (const crop of crops) {
    const imgc = jpg.clone() // .greyscale().contrast(.7)
    const name = crop[0]
    imgc.crop(crop[1] * ratio, crop[2] * ratio, crop[3] * ratio, crop[4] * ratio)
    const text = await img2text.img2text(imgc, DEBUG)
    const n = reformatnum(text)
    res[name] = n
    ncnt += n != "-" ? 1 : 0
  }
  if (ncnt == 2) {
    if (res.ninspections == '-') {
      res.ninspections = res.npatients + res.nnotpatients
    } else if (res.npatients == '-') {
      res.npatients = res.ninspections - res.nnotpatients
    } else {
      res.nnotpatients = res.ninspections - res.npatients
    }
  }
  const parseDate = function(s) {
    s = s.substring(s.indexOf('pcr_'))
    return s.substring(4, 8) + "-" + s.substring(8, 10) + "-" + s.substring(10, 12)
  }
  res.lastUpdate = parseDate(fn)
  return res
}
const DEBUG = false
const getJSONbyImage = async function(url) {
  const fn = PATH + url.substring(url.lastIndexOf('/') + 1)
  try {
    const data = fs.readFileSync(fn + ".json")
    return JSON.parse(data)
  } catch (e) {
  }
  const img = await (await fetch(url)).arrayBuffer()
  fs.writeFileSync(fn, new Buffer.from(img), 'binary')
  const json = await getCurrentPatients(fn)
  json.srcurl_img = url
  json.srcurl_web = URL
  fs.writeFileSync(fn + ".json", JSON.stringify(json))
  return json
}

const getCovid19DataSummaryForIchigoJam = async function() {
  const json = await getCovid19DataJSON()
  return util.simplejson2txt(json)
}

const main = async function() {
  //const data = await getCurrentPatients("pcr_20200317.jpg")
  const data = await getCovid19DataJSON(1000 * 60)
  //console.log(data)
  console.log(await getCovid19DataSummaryForIchigoJam())
}
if (require.main === module) {
  main()
} else {
  startUpdate()
}

exports.getCovid19DataJSON = getCovid19DataJSON
exports.getCovid19DataSummaryForIchigoJam = getCovid19DataSummaryForIchigoJam
