const fs = require('fs')
const fetch = require('node-fetch')
const cheerio = require('cheerio')
const util = require('./util.js')
const jimp = require("jimp")
const img2text = require('./img2text.js')
const pdf2text = require('./pdf2text.js')

const PATH = 'data/covid19japan/'
const URL = 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000164708_00001.html'
const BASEURL = 'https://www.mhlw.go.jp'

const getCovid19Data = async function(cachetime) {
  return await util.getWebWithCache(URL, PATH, cachetime)
}
const getLastUpdate = function(fn) {
  return util.getLastUpdateOfCache(URL, PATH)
}

const getCovid19DataJSON = async function(cachetime) {
  const data = await util.getCache(async function() {
    return await fetchCovid19DataJSON(cachetime)
  }, 'data/covid19japan/', '-summary.json', cachetime)
  return JSON.parse(data)
}
const fetchCovid19DataJSON = async function(cachetime) {
  const data = await getCovid19Data(cachetime)
  const dom = cheerio.load(data)
  const weeks = []
  const res = {}
  let state = 0
  let url = null
  dom('.m-grid__col1').each((idx, ele) => {
    for (let i = 0; i < ele.children.length; i++) {
      if (state == 0) {
        const text = ele.children[i].data
        if (text && text.trim() == '入退院の状況は以下の通りです。') {
          state = 1
        }
      } else if (state == 1) {
        const tag = ele.children[i].name
        if (tag == 'img') {
          const fn = dom(ele.children[i]).attr('src')
          url = fn
          state = 2
        } else if (tag == 'a') {
          const fn = dom(ele.children[i]).attr('href')
          if (fn.endsWith('.pdf')) {
            url = fn
            state = 2
          }
          /*
        } else if (tag == 'a' && ele.children[i].children.length) {
          const tag2 = ele.children[i].children[0].name
          if (tag2 == 'img') {
            const fn = dom(ele.children[i].children[0]).attr('src')
            url = fn
            state = 2
          }
          */
        }
      }
    }
  })
  if (!url) {
    return null // err
  }
  if (url.indexOf(":") == -1) {
    url = BASEURL + url
  }
  let json = null
  if (url.endsWith(".pdf")) {
    json = await getJSONbyPDF(url)
  } else {
    json = await getJSONbyImage(url)
  }
  return JSON.stringify(json)
}

const getCurrentPatients = async function(fn) {
  const jpg = await jimp.read(fn)
  /*
  const orgwidth = 2339
  const crops = [
    //[ 'lastUpdate', 1573, 112, 2116 - 1573, 178 - 115 ],
    [ 'lastUpdate', 1573, 112 - 10, 2116 - 1573, 178 - 115 + 10 ],
    [ 'npatients', 60, 400, 500, 90 ],
    [ 'nexits', 620, 400, 530, 90 ],
    [ 'ndeaths', 1180, 400, 464, 90 ],
    [ 'ncurrentpatients', 1686, 400, 584, 90 ],
    //[ 'nlighters', 1686, 582, 584, 60 ], // for first
    [ 'nlighters', 1686, 562, 584, 60 ],
  ]
  */
  const orgwidth = 744
  const crops = [
    [ 'lastUpdate', 504, 38, 158, 22 ],
    [ 'npatients', 58, 139, 116, 28 ],
    [ 'nexits', 231, 126, 113, 30 ],
    [ 'ndeaths', 568, 138, 137, 32 ],
    [ 'ncurrentpatients', 390, 126, 136, 32 ],
    [ 'nlighters', 430, 156, 39, 19 ],
  ]
  const ratio = jpg.bitmap.width / orgwidth
  // 3A12H (WN) 18
  const reformatdate = function(s) {
    s = s.replace(/ /g, "")
    const num = s.match(/(\d+)A(\d+)([^\d]*)\(.+\)(\d+)/)
    if (!num)
      return "--"
    const m = parseInt(num[1])
    const d = num[3].length == 0 ? Math.floor(parseInt(num[2]) / 10) : parseInt(num[2])
    const h = parseInt(num[4])
    const y = new Date().getFullYear()
    if (m == 12 && new Date().getMonth() == 0) // 年末対策?
      y--
    const fix0 = (n) => n < 10 ? "0" + n : "" + n
    return y + "-" + fix0(m) + "-" + fix0(d) + "T" + fix0(h) + ":00"
  }
  const reformatnum = function(s) {
    s = s.replace(/ /g, "")
    const num = s.match(/(\d+).+/)
    if (!num)
      return "-"
    return num[1]
  }
  const res = {}
  for (const crop of crops) {
    const imgc = jpg.clone()
    const name = crop[0]
    imgc.crop(crop[1] * ratio, crop[2] * ratio, crop[3] * ratio, crop[4] * ratio)
    const text = await img2text.img2text(imgc, DEBUG)
    console.log(text)
    res[name] = name == 'lastUpdate' ? reformatdate(text) : reformatnum(text)
  }
  // 3/14 18:00
  /*
  res.nexits = '157'
  res.nlighters = '13'
  */
  return res
}
const DEBUG = false
const getJSONbyImage = async function(url) {
  let fn = null
  if (url.startsWith("data:")) {
    fn = PATH + getLastUpdate().replace(/:/g, '_') + "_smr.png" // "2020-03-16.png"
    console.log(fn)
    try {
      const data = fs.readFileSync(fn + ".json")
      return JSON.parse(data)
    } catch (e) {
    }
    const buf = Buffer.from(url.substring("data:image/png;base64".length), 'base64')
    fs.writeFileSync(fn, buf)
  } else {
    fn = PATH + url.substring(url.lastIndexOf('/') + 1)
    try {
      const data = fs.readFileSync(fn + ".json")
      return JSON.parse(data)
    } catch (e) {
    }
    const img = await (await fetch(url)).arrayBuffer()
    fs.writeFileSync(fn, new Buffer.from(img), 'binary')
  }
  const json = await getCurrentPatients(fn)
  if (!url.startsWith("data:"))
    json.srcurl_img = url
  json.srcurl_web = URL
  fs.writeFileSync(fn + ".json", JSON.stringify(json))
  return json
}
// for pdf
const parseDate = function(s) { // '３月１６日（月）１８時時点'
  s = util.toHalf(s)
  //let num1 = s.substring(0, s.indexOf('（') - 1).match(/(\d+)月(\d+)日/)
  //let num2 = s.substring(s.indexOf('）'+ 1)).match(/(\d+)時時点/)

  let num = s.match(/(\d+)月(\d+)日\(.\)(\d+)時時点/)
  const y = new Date().getFullYear()
  const m = num[1]
  const d = num[2]
  const h = num[3]
  if (m == 12 && new Date().getMonth() == 0) // 年末対策?
    y--
  const fix0 = (n) => n < 10 ? "0" + n : "" + n
  return y + "-" + fix0(m) + "-" + fix0(d) + "T" + fix0(h) + ":00"
}

const getCurrentPatientsByPDF = async function(fn) {
  const text = await pdf2text.pdf2text(fn)
  const ss = text.split('\n')
  //console.log(ss)
  const parseNum = function(s) {
    s = util.toHalf(s)
    return parseInt(s)
  }
  /*
  'PCR検査陽性者',
  '退院者 現在も入院等 死亡者',
  '８２４（＋１５）',
  '１７１（＋７） ６２５（＋４）',
  '２８（＋４）',
  '【国内事例】',
  '新型コロナウイルス感染症に関する入退院の状況',
  '（注）１【国内事例】には、上記のほか空港検疫で確認されたPCR検査陽性者５名がいる。',
  '２【クルーズ船事例】にはチャーター便帰国した者（４０名）は含めない。',
  '３【クルーズ船事例】には藤田岡崎医療センター分を含む。',
  '３月１６日（月）１８時時点',
  'PCR検査陽性者',
  '退院者 現在も入院等 死亡者',
  '６７２',
  '５０８（＋50） １５７（－50）',
  '7',
  '【クルーズ船事例】',
  'PCR検査陽性者',
  '退院者 現在も入院等 死亡者',
  '１４９６（＋15）',
  '６７９（＋57） ７８２（－46）',
  '３５（＋４）',
  '【総計】',
  '重症→軽～中等症になった者 １３',
  '重症→軽～中等症になった者 ４１',
  '重症→軽～中等症になった者 ２８',
  ''
  */
  const res = {}
  res.lastUpdate = parseDate(ss[10])
  res.npatients = parseNum(ss[2])
  res.nexits = parseNum(ss[3])
  res.ndeaths = parseNum(ss[4])
  res.ncurrentpatients = parseNum(ss[3].substring(ss[3].indexOf('）') + 1))
  res.nlighters = parseNum(ss[23].substring(ss[23].indexOf('者') + 1))
  return res
}
const getJSONbyPDF = async function(url) {
  const fn = PATH + url.substring(url.lastIndexOf('/') + 1)
  try {
    const data = fs.readFileSync(fn + ".json")
    return JSON.parse(data)
  } catch (e) {
  }
  const img = await (await fetch(url)).arrayBuffer()
  fs.writeFileSync(fn, new Buffer.from(img), 'binary')
  const json = await getCurrentPatientsByPDF(fn)
  json.srcurl_pdf = url
  json.srcurl_web = URL
  fs.writeFileSync(fn + ".json", JSON.stringify(json))
  return json
}
const getCovid19DataSummaryForIchigoJam = async function() {
  const json = await getCovid19DataJSON()
  return util.simplejson2txt(json)
}

const main = async function() {
  const data = await getCovid19DataJSON(1000 * 60)
  console.log(data)
  //console.log(await getCovid19DataSummaryForIchigoJam())
}
if (require.main === module) {
  main()
} else {
}

exports.getCovid19DataJSON = getCovid19DataJSON
exports.getCovid19DataSummaryForIchigoJam = getCovid19DataSummaryForIchigoJam
