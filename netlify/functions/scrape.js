import chromium from 'chrome-aws-lambda';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import puppeteerExtra from 'puppeteer-extra';


puppeteerExtra.use(StealthPlugin());

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

async function loadJobDetails(browser, job) {
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', req => {
      const blocked = ['image', 'stylesheet', 'font', 'media'];
      if (blocked.includes(req.resourceType())) req.abort();
      else req.continue();
    });

    await page.setUserAgent('Mozilla/5.0');
    await page.goto(job.jobLink, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('article', { timeout: 10000 });

    const { description, date } = await page.evaluate(() => {
      const desc = document.querySelector('article')?.innerText.trim() || 'No description found';
      const jobDate = document.querySelector('time')?.getAttribute('datetime') || 'Date not found';
      return { description: desc, date: jobDate };
    });

    await page.close();

    return {
      ...job,
      jobDescription: description,
      jobType: inferJobType(description),
      jobTitle: job.jobTitle === 'Title not found' ? inferJobTitle(description) : job.jobTitle,
      jobLocation: inferLocation(description),
      jobDate: date,
    };
  } catch (err) {
    return {
      ...job,
      jobDescription: 'Failed to load',
      jobType: 'Error',
      jobTitle: 'Unknown',
      jobLocation: 'Unknown',
      jobDate: 'Error',
    };
  }
}

async function scrapeHimalayas() {
  const browser = await puppeteerExtra.launch({
    executablePath: await chromium.executablePath,
    headless: chromium.headless,
    args: chromium.args,
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0');
  await page.setRequestInterception(true);
  page.on('request', req => {
    const blocked = ['image', 'stylesheet', 'font', 'media'];
    if (blocked.includes(req.resourceType())) req.abort();
    else req.continue();
  });

  await page.goto('https://himalayas.app/jobs', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('a[href*="/jobs/"]');

  const jobs = await page.evaluate(() => {
    const jobCards = Array.from(document.querySelectorAll('a[href*="/jobs/"]')).slice(0, 20);
    return jobCards.map(card => {
      const title = card.querySelector('div.flex > div > h3')?.innerText.trim() || 'Title not found';
      const company = card.querySelector('div.flex > div > p')?.innerText.trim() || 'Company not found';
      const link = card.href;
      return { jobTitle: title, jobCompany: company, jobLink: link };
    });
  });

  await page.close();

  const enrichedJobs = await Promise.all(jobs.map(job => loadJobDetails(browser, job)));
  await browser.close();

  return enrichedJobs;
}
export const handler = async () => {
  try {
    const data = await scrapeHimalayas();
    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
