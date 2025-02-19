//import * as parse5 from 'https://cdn.jsdelivr.net/npm/parse5@7.2.0/+esm';
import * as parse5 from 'parse5';

async function notifyAll(source, html) {

  const links = getLinksHtml(html);

  const targets = Array.from(new Set(links.map(l => l.href)));

  const promises = [];
  for (const target of targets) {
    promises.push(findEndpoint(target));
  }

  const endpoints = await Promise.all(promises);

  for (let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i];
    if (endpoint) {
      notifyEndpoint(endpoint.href, source, targets[i]);
    }
  }
}

function getLinksHtml(html) {
  const node = parse5.parse(html);
  const parseLinks = getLinks(node);

  const links = [];

  for (const parseLink of parseLinks) {
    const link = {};
    for (const attr of parseLink.attrs) {
      link[attr.name] = attr.value;
    }

    links.push(link);
  }

  return links;
}

function getLinks(node) {
  let links = [];

  if (node.nodeName === 'a' || node.nodeName === 'link') {
    links.push(node);
  }

  if (node.childNodes) {
    for (const child of node.childNodes) {
      links = [...links, ...getLinks(child)];
    }
  }

  return links;
}

async function notifyEndpoint(endpoint, source, target) {

  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        source,
        target,
      }),
    });
  }
  catch(e) {
    console.error(e);
    return null;
  }

  if (!res.ok) {
    console.log(res);
  }
}

async function findEndpoint(url) {
  let res;
  try {
    res = await fetch(url);
  }
  catch (e) {
    console.error(e);
    return null;
  }

  if (!res.ok) {
    return null;
  }

  const linkHeader = res.headers.get('link');
  if (linkHeader) {
    const links = parseLinkHeader(url, linkHeader);

    for (const link of links) {
      if (link.href && link.rel === 'webmention') {
        expandLink(url, link);
        return link;
      }
    }
  }

  const html = await res.text();

  const links = getLinksHtml(html);

  for (const link of links) {
    if (link.href && link.rel === 'webmention') {
      expandLink(url, link);
      return link;
    }
  }

  return null;
}

function parseLinkHeader(baseUrl, header) {

  const rawLinks = header.split(',')
    .map(l => l.trim().split(';'))

  const links = [];
  for (const rawLink of rawLinks) {
    const link = {};
    link.href = rawLink[0].replaceAll('<', '').replaceAll('>', '');

    expandLink(baseUrl, link);

    for (const pair of rawLink.slice(1)) {
      const [key, value] = pair.trim().split('=');
      link[key] = value.trim().replaceAll('"', '').replaceAll("'", '');
    }

    links.push(link);
  }

  return links;
}

function expandLink(baseUrl, link) {
  // Handle relative URLs
  if (link.href.startsWith('http')) {
    return;
  }
  else if (link.href.startsWith('/')) {
    const parsedUrl = new URL(baseUrl);
    link.href = `${parsedUrl.origin}${link.href}`;
  }
  else if (link.href.startsWith('.')) {
    link.href = baseUrl + link.href;
  }
  else {
    const parts = baseUrl.split('/');
    const dirParts = parts.slice(0, parts.length - 1);
    link.href = dirParts.join('/') + '/' + link.href;
  }
  return link;
}

function parseHtmlLinks(html) {
  //const regexA = /<a(.*)>.*<\/a>/g;
  const regexA = /<a(.*?)>/g;
  const regexLink = /<link(.*?)>/g;
  const results = [...html.matchAll(regexA), ...html.matchAll(regexLink)];

  const unparsedLinks = results
    .map(r => r[1].trim())
    .map(l => l.split(' '));

  const links = [];

  for (const unparsedLink of unparsedLinks) {

    const link = {};

    for (const unparsedPair of unparsedLink) {
      const parts = unparsedPair.split('=');
      const [key, value] = parts;
      link[key] = value.replaceAll('"', '').replaceAll("'", '');
    }

    links.push(link);
  }

  return links;
}

export {
  expandLink,
  notifyAll,
  getLinksHtml,
};
