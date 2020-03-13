const util = require('./util.js')

const CACHE_TIME = 1 * 60 * 60 * 1000 // 1hour
//const CACHE_TIME = 1 * 60 * 1000 // 1min
const PATH = 'data/covid19tokyo/'
const URL = 'https://raw.githubusercontent.com/tokyo-metropolitan-gov/covid19/master/data/data.json'

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

const getCovid19DataJSON = async function() {
  return JSON.parse(await getCovid19Data())
}

const getCovid19DataSummary = async function() {
  const json = await getCovid19DataJSON()
  return {
    'n_inspections': json.main_summary.value,
    'n_patients': json.main_summary.children[0].value,
    'n_light': json.main_summary.children[0].children[0].children[0].value,
    'n_heavy': json.main_summary.children[0].children[0].children[1].value,
    'n_exit': json.main_summary.children[0].children[1].value,
    'n_death': json.main_summary.children[0].children[2].value,
    's_lastUpdate': json.lastUpdate,
  }
}
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
const getCovid19DataSummaryForIchigoJam = async function() {
  const json = await getCovid19DataSummary()
  return simplejson2txt(json)
}

const main = async function() {
  const data = await getCovid19Data()
  console.log(data)
  const d = await getCovid19DataSummaryForIchigoJam()
  console.log(d)
}
if (require.main === module) {
  main()
} else {
  startUpdate()
}

exports.getCovid19DataJSON = getCovid19DataJSON
exports.getCovid19DataSummary = getCovid19DataSummary
exports.getCovid19DataSummaryForIchigoJam = getCovid19DataSummaryForIchigoJam
