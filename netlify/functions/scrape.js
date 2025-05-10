const axios = require('axios');
const cheerio = require('cheerio');

function inferJobTitle(description) {
  const categories = [
    { title: 'Software Engineering', keywords: ['developer', 'software', 'frontend', 'backend', 'engineer', 'programmer', 'typescript', 'python', 'javascript'] },
    { title: 'Customer Support', keywords: ['support', 'customer', 'help desk', 'client service', 'csr'] },
    { title: 'Marketing', keywords: ['marketing', 'seo', 'social media', 'brand', 'growth', 'campaign', 'content marketing'] },
    { title: 'Sales', keywords: ['sales', 'account executive', 'business development', 'revenue'] },
    { title: 'Product Management', keywords: ['product manager', 'product', 'roadmap', 'user feedback', 'feature', 'requirements'] },
    { title: 'Design', keywords: ['designer', 'ux', 'ui', 'graphic', 'illustrator', 'figma'] },
    { title: 'Human Resources', keywords: ['recruiter', 'talent acquisition', 'human resources', 'hr'] },
    { title: 'Healthcare', keywords: ['healthcare', 'clinic', 'nurse', 'mental health', 'therapist', 'doctor'] },
    { title: 'Finance', keywords: ['finance', 'accounting', 'bookkeeping', 'financial', 'controller'] },
    { title: 'Education', keywords: ['teacher', 'education', 'training', 'e-learning', 'curriculum'] },
    { title: 'Legal', keywords: ['legal', 'lawyer', 'compliance', 'contract'] },
    { title: 'Operations', keywords: ['operations', 'logistics', 'process', 'supply chain'] },
  ];
  const lowerDesc = description.toLowerCase();
  for (const category of categories) {
    if (category.keywords.some(keyword => lowerDesc.includes(keyword))) {
      return category.title;
    }
  }
  return 'Other';
}

function inferJobType(description) {
  if (/full[-\s]?time/i.test(description)) return 'Full-time';
  if (/part[-\s]?time/i.test(description)) return 'Part-time';
  if (/contract/i.test(description)) return 'Contract';
  if (/freelance/i.test(description)) return 'Freelance';
  if (/intern/i.test(description)) return 'Internship';
  return 'Unknown Type';
}

function inferLocation(description) {
  const match = description.match(/\b(remote|usa|united states|canada|uk|europe|germany|australia|india|singapore|netherlands|anywhere)\b/i);
  return match ? match[0] : 'Location not found';
}

async function scrapeHimalayas(listURL) {
  const baseURL = 'https://himalayas.app';
  const { data: html } = await axios.get(listURL, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });

  const $ = cheerio.load(html);
  const jobCards = $('.jobs-grid a[href^="/jobs/"]').slice(0, 10); // Limit to first 20 jobs

  const jobs = [];

  const jobPromises = jobCards.map(async (i, card) => {
    const title = $(card).find('div.flex > div > h3').text().trim() || 'Title not found';
    const company = $(card).find('div.flex > div > p').text().trim() || 'Company not found';
    const link = baseURL + $(card).attr('href');

    try {
      const jobPage = await axios.get(link, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const $$ = cheerio.load(jobPage.data);
      const description = $$('article').text().trim() || 'No description found';
      const date = $$('time').attr('datetime') || 'Date not found';

      jobs.push({
        jobTitle: title === 'Title not found' ? inferJobTitle(description) : title,
        jobCompany: company,
        jobLink: link,
        jobDescription: description,
        jobType: inferJobType(description),
        jobLocation: inferLocation(description),
        jobDate: date
      });
    } catch (err) {
      jobs.push({
        jobTitle: title,
        jobCompany: company,
        jobLink: link,
        jobDescription: 'Failed to load',
        jobType: 'Error',
        jobLocation: 'Unknown',
        jobDate: 'Error'
      });
    }
  }).get();

  await Promise.all(jobPromises);

  return jobs;
}

exports.handler = async (event) => {
  try {
    const baseURL = 'https://himalayas.app';
    const listURL = decodeURIComponent(
      event.queryStringParameters?.url
        ? `${baseURL}${event.queryStringParameters.url}`
        : `${baseURL}/jobs/communication-skills`
    );    
    const data = await scrapeHimalayas(listURL);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
      body: JSON.stringify(data),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
