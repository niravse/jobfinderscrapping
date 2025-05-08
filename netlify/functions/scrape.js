const axios = require('axios');
const cheerio = require('cheerio');

const baseURL = 'https://himalayas.app';
const listURL = `${baseURL}/jobs`;

exports.handler = async () => {
  try {
    const { data: html } = await axios.get(listURL, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const $ = cheerio.load(html);
    const jobCards = $('a[href*="/jobs/"]').slice(0, 10); // Fast!

    const jobs = [];

    jobCards.each((i, card) => {
      const title = $(card).find('div.flex > div > h3').text().trim() || 'No title';
      const company = $(card).find('div.flex > div > p').text().trim() || 'No company';
      const link = baseURL + $(card).attr('href');

      jobs.push({
        jobTitle: title,
        jobCompany: company,
        jobLink: link,
      });
    });

    return {
      statusCode: 200,
      body: JSON.stringify(jobs),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
