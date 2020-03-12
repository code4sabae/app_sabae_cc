const http = require('http')
const fs = require('fs')
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
const convertCSVtoArray = function(s) {
	const res = []
	let st = 0
	let line = []
	let sb = null
	if (!s.endsWith("\n"))
		s += "\n"
	const len = s.length
	for (let i = 0; i < len; i++) {
		let c = s.charAt(i)
		if (c == '\r')
			continue
		if (st == 0) {
			if (c == '\n') {
				if (line.length > 0)
					line.push("")
				res.push(line)
				line = []
			} else if (c == ',') {
				line.push("")
			} else if (c == '"') {
				sb = ""
				st = 2
			} else {
				sb = c
				st = 1
			}
		} else if (st == 1) {
			if (c == '\n') {
				line.push(sb)
				res.push(line)
				line = []
				st = 0
				sb = null
			} else if (c == ',') {
				line.push(sb)
				sb = null
				st = 0
			} else {
				sb += c
			}
		} else if (st == 2) {
			if (c == '"') {
				st = 3
			} else {
				sb += c
			}
		} else if (st == 3) {
			if (c == '"') {
				sb += c
				st = 2
			} else if (c == ',') {
				line.push(sb)
				sb = null
				st = 0
			} else if (c == '\n') {
				line.push(sb)
				res.push(line)
				line = []
				st = 0
				sb = null
			}
		}
	}
	if (sb != null)
		line.push(sb)
	if (line.length > 0)
		res.push(line)
	return res
}
const csv2json = function(csv) {
	const res = []
	const head = csv[0]
	for (let i = 1; i < csv.length; i++) {
		const d = {}
		for (let j = 0; j < head.length; j++) {
			d[head[j]] = csv[i][j]
		}
		res.push(d)
	}
	return res
}
const fetchCSVfromGoogleSpreadSheet = async function(key) {
	const csvurl = `https://docs.google.com/spreadsheets/d/e/${key}/pub?gid=0&single=true&output=csv`
  const csv = await (await fetch(csvurl)).text()
  //console.log(csv)
	const data = convertCSVtoArray(csv)
	//data.shift()
	return csv2json(data)
}

const main = async function() {
  const key = '2PACX-1vSFMNp5HcRNOF5MrAujEUWR1dIoX2mncMEWTbPlVAaJqKWiq831-6gnCyI7n_G8YfPqNQXrfwyVjyHL'
  const data = await fetchCSVfromGoogleSpreadSheet(key)
  console.log(data)
}
//main()

//startUpdate()

exports.fetchCSVfromGoogleSpreadSheet = fetchCSVfromGoogleSpreadSheet
