const http = require('http')
const fs = require('fs')
const fetch = require('node-fetch')

function makeJSON(xml) {
	let obj = {}
	if (xml.nodeType == 1) { // element
		if (xml.attributes.length > 0) {
			for (var j = 0; j < xml.attributes.length; j++) {
        const attribute = xml.attributes.item(j)
        obj[attribute.nodeName] = attribute.nodeValue
			}
		}
	} else if (xml.nodeType == 3) { // text
    obj = xml.nodeValue
	}
	if (xml.hasChildNodes()) {
    if (xml.childNodes.length == 1 && xml.childNodes.item(0).nodeName == "#text") {
      return xml.childNodes.item(0).data
    }
		for (let i = 0; i < xml.childNodes.length; i++) {
			const item = xml.childNodes.item(i)
      const nodeName = item.nodeName
      if (nodeName == undefined) {
      } else if (typeof(obj[nodeName]) == "undefined") {
        if (!(nodeName == "#text" && item.data == '\n')) {
          obj[nodeName] = makeJSON(item)
        }
			} else {
				if (typeof(obj[nodeName].push) == "undefined") {
					var old = obj[nodeName]
					obj[nodeName] = []
					obj[nodeName].push(old)
				}
				obj[nodeName].push(makeJSON(item))
			}
		}
	}
	return obj
}
/*
function xml2json(xml) {
	var obj = {};
	if (xml.nodeType == 1) { // element
		// do attributes
		if (xml.attributes.length > 0) {
		obj["@attributes"] = {};
			for (var j = 0; j < xml.attributes.length; j++) {
				var attribute = xml.attributes.item(j);
				obj["@attributes"][attribute.nodeName] = attribute.nodeValue;
			}
		}
	} else if (xml.nodeType == 3) { // text
		obj = xml.nodeValue;
	}

	// do children
	if (xml.hasChildNodes()) {
		for(var i = 0; i < xml.childNodes.length; i++) {
			var item = xml.childNodes.item(i);
			var nodeName = item.nodeName;
			if (typeof(obj[nodeName]) == "undefined") {
				obj[nodeName] = xml2json(item);
			} else {
				if (typeof(obj[nodeName].push) == "undefined") {
					var old = obj[nodeName];
					obj[nodeName] = [];
					obj[nodeName].push(old);
				}
				obj[nodeName].push(xml2json(item));
			}
		}
	}
	return obj;
}
*/
const DOMParser = require('xmldom').DOMParser
const toJSONfromXMLString = function(s) {
  const parser = new DOMParser()
  const xml = parser.parseFromString(s) // "<a att1='1' att2='b'>b</a>")
  return makeJSON(xml)
}

const test = function() {
  const s = `<opendata dataType='A'>
  <mail>a</mail><mail>b</mail></opendata>`
  console.log(JSON.stringify(toJSONfromXMLString(s)))
  //console.log(JSON.parse(xml2json.toJson(s)))
  return
}

function saveData(fn, data) {
  fs.writeFileSync('data/' + fn, data)
  //JSON.stringify(data))
}
function loadData(fn) {
  return fs.readFileSync('data/' + fn, 'utf-8')
//  alldata = JSON.parse(fs.readFileSync(PATH_DATA)).results.bindings
}

const convertCSVtoArray = function(s) {
	const lines = s.split("\n")
	const res = []
	for (let i = 0; i < lines.length; i++) {
		const ar = lines[i].split(",")
		res.push(ar)
	}
	return res
}
const fix0 = function(n, beam) {
  const s = "000000000" + n
  return s.substring(s.length - beam)
}
/*
{"opendata":
  {"dataType":"A","lastModified":"2020/03/04 08:10:15","mailCount":"194","odType":"02","xmlAllUrl":"https://www.ezairyu.mofa.go.jp/opendata/area/newarrivalA.xml","xmlNormalUrl":"https://www.ezairyu.mofa.go.jp/opendata/area/newarrival.xml","xmlLightUrl":"https://www.ezairyu.mofa.go.jp/opendata/area/newarrivalL.xml",
  "mail":[
    {"keyCd":"79978","infoType":"R10","infoName":"領事メール(一般)","infoNameLong":"領事メール(一般)","leaveDate":"2020/03/04 08:05:29","area":{"cd":"30","name":"北米"},"country":{"areaCd":"30","cd":"9001","name":"カナダ"},"title":"新型コロナウイルスにかかる注意喚起","lead":
*/
const fetchGlobalSafeData = async function() {
  //const xml = loadData('2020030408-newarrivalA.xml')
  const URL = 'https://www.ezairyu.mofa.go.jp/opendata/area/newarrivalA.xml'
  const xml = await (await fetch(URL)).text()
  //const json = JSON.parse(xml2json.toJson(xml))
  const json = toJSONfromXMLString(xml)
  return json
}
const updateGlobalSafeData = async function() {
  const data = await fetchGlobalSafeData()
  for (let i = 0; i < data.opendata.mail.length; i++) {
    const m = data.opendata.mail[i]
    const id = m.keyCd
    const fn = 'globalsafe/' + id + ".json"
    try {
      loadData(fn)
    } catch (e) {
      saveData(fn, JSON.stringify(m))
      //console.log(fn)
    }
  }
}
const startUpdateGlobalSafeData = function() {
  updateGlobalSafeData()
  setInterval(function() {
    updateGlobalSafeData()
  }, 60 * 1000 * 5) // 5men
}

// country: { areaCd: '30', cd: '9001', name: 'カナダ' },
const getGlobalSafeDataByCountry = function(countryname) {
  const fns = fs.readdirSync("data/globalsafe")
  const res = []
  for (let i = 0; i < fns.length; i++) {
    const json = JSON.parse(fs.readFileSync("data/globalsafe/" + fns[i], "utf-8"))
    if (json && json.country && json.country.name == countryname)
      res.push(json)
  }
  return res
}
const getGlobalSafeDataByKeyword = function(key, limit) {
  if (!limit)
    limit = 50
  const keys = key.split(' ')
  const fns = fs.readdirSync("data/globalsafe")
  fns.sort(function(a, b) {
    const an = parseInt(a)
    const bn = parseInt(b)
    return bn - an // 新しいもの先
    //return an - bn // 古いもの先
  })
  const res = []
  A: for (let i = 0; i < fns.length; i++) {
    const json = fs.readFileSync("data/globalsafe/" + fns[i], "utf-8")
    for (let j = 0; j < keys.length; j++) {
      if (json.indexOf(keys[j]) == -1)
        continue A
    }
    res.push(JSON.parse(json))
    if (!--limit)
      break
  }
  return res
}

const main = async function() {
  //startUpdateGlobalSafeData()

  const d = getGlobalSafeDataByKeyword('カナダ イラン', 100)
  console.log(d)
  console.log(d.length)
  
 /*
  const data = await fetchGlobalSafeData()
  console.log(data)
  console.log(data.opendata.mail[0])
  */
}
if (require.main === module) {
  main()
} else {
  startUpdateGlobalSafeData()
}

exports.getGlobalSafeDataByKeyword = getGlobalSafeDataByKeyword
