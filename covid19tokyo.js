const fs = require('fs')
const fetch = require('node-fetch')

function saveData(fn, data) {
  fs.writeFileSync('data/' + fn, data)
  //JSON.stringify(data))
}
function loadData(fn) {
  return fs.readFileSync('data/' + fn, 'utf-8')
//  alldata = JSON.parse(fs.readFileSync(PATH_DATA)).results.bindings
}

const fix0 = function(n, beam) {
  const s = "000000000" + n
  return s.substring(s.length - beam)
}
const getYMDH = function() {
  const t = new Date()
  return t.getFullYear() + fix0(t.getMonth() + 1, 2) + fix0(t.getDate(), 2) + fix0(t.getHours(), 2)
}
/*
{"opendata":
  {"dataType":"A","lastModified":"2020/03/04 08:10:15","mailCount":"194","odType":"02","xmlAllUrl":"https://www.ezairyu.mofa.go.jp/opendata/area/newarrivalA.xml","xmlNormalUrl":"https://www.ezairyu.mofa.go.jp/opendata/area/newarrival.xml","xmlLightUrl":"https://www.ezairyu.mofa.go.jp/opendata/area/newarrivalL.xml",
  "mail":[
    {"keyCd":"79978","infoType":"R10","infoName":"領事メール(一般)","infoNameLong":"領事メール(一般)","leaveDate":"2020/03/04 08:05:29","area":{"cd":"30","name":"北米"},"country":{"areaCd":"30","cd":"9001","name":"カナダ"},"title":"新型コロナウイルスにかかる注意喚起","lead":
*/
const fetchCovid19TokyoData = async function() {
  try {
    //const xml = loadData('2020030408-newarrivalA.xml')
    const URL = 'https://raw.githubusercontent.com/tokyo-metropolitan-gov/covid19/master/data/data.json'
    const json = await (await fetch(URL)).json()
    return json
  } catch (e) {
  }
  return null
}
const updateCovid19TokyoData = async function() {
  const fn = 'covid19tokyo/' + getYMDH() + ".json"
  const json = await fetchCovid19TokyoData()
  if (json)
    saveData(fn, JSON.stringify(json))
}
const startUpdateCovid19TokyoData = function() {
  updateCovid19TokyoData()
  setInterval(function() {
    updateCovid19TokyoData()
  }, 60 * 1000 * 60) // 1hour
}

// country: { areaCd: '30', cd: '9001', name: 'カナダ' },
const getCovid19TokyoData = async function() {
  let data = null
  try {
    data = fs.readFileSync("data/covid19tokyo/" + getYMDH() + ".json", "utf-8")
  } catch (e) {
    await updateCovid19TokyoData()
    data = fs.readFileSync("data/covid19tokyo/" + getYMDH() + ".json", "utf-8")
  }
//  console.log(data)
  const json = JSON.parse(data)
  return json
}
const getCovid19TokyoDataSummary = async function() {
  const json = await getCovid19TokyoData()
  //console.log(JSON.stringify(json.main_summary))
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
const getCovid19TokyoDataSummaryForIchigoJam = async function() {
  const json = await getCovid19TokyoDataSummary()
  return simplejson2txt(json)
}

const main = async function() {
  startUpdateCovid19TokyoData()

  const d = await getCovid19TokyoDataSummaryForIchigoJam()
  console.log(d)
}
//main()

exports.startUpdateCovid19TokyoData = startUpdateCovid19TokyoData
exports.getCovid19TokyoData = getCovid19TokyoData
exports.getCovid19TokyoDataSummary = getCovid19TokyoDataSummary
exports.getCovid19TokyoDataSummaryForIchigoJam = getCovid19TokyoDataSummaryForIchigoJam
