const cheerio = require('cheerio')
const util = require('./util.js')

const PREF = util.JAPAN_PREF
const PREF_EN = util.JAPAN_PREF_EN

const CACHE_TIME = 1 * 60 * 60 * 1000 // 1hour
const PATH = 'data/covid19cio/'
const URL = 'https://cio.go.jp/node/2581'

const getCovid19Data = async function(cachetime) {
  return await util.getWebWithCache(URL, PATH, cachetime)
}
const getCovid19DataJSON = async function(cachetime) {
  const data = await util.getCache(async function() {
    return JSON.stringify(await fetchCovid19DataJSON(cachetime))
  }, PATH, '.json', cachetime)
  return JSON.parse(data)
}
const startUpdate = function() {
  setInterval(async function() {
    await util.getWebWithCache(URL, PATH, CACHE_TIME)
  }, CACHE_TIME)
}
const fetchCovid19DataJSON = async function(cachetime) {
  const data = await getCovid19Data(cachetime)
  const dom = cheerio.load(data)
  const weeks = []
  let state = 0
  const res = {}
  let flg = false
  dom('article').each((idx, ele) => {
    if (flg)
      return
    const article = dom(ele)
    const h1 = article.find('h1')
    const title = h1.text()
    if (title != '東京都のオープンソースを活用した新型コロナウイルス感染症対策サイトの紹介')
      return
    res.lastUpdate = article.find('time').attr("datetime")

    res.title = title
    let npref = -1
    const list = []
    for (let i = 0; i < ele.children.length; i++) {
      const ele2 = ele.children[i]
      if (ele2.name == 'p') {
        const s = dom(ele2).text()
        const nextnpref = PREF.indexOf(s)
        if (nextnpref < 0 && npref >= 0) {
          list.push({ name: PREF_EN[npref], name_jp: PREF[npref], url: s })
        }
        npref = nextnpref
      }
    }
    res.area = list
  })
  return res
}

const main = async function() {
  const data = await getCovid19DataJSON(1000 * 60)
  console.log(data)
}
if (require.main === module) {
  main()
} else {
  startUpdate()
}

exports.getCovid19DataJSON = getCovid19DataJSON
