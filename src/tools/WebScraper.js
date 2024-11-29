const axios = require('axios');
const cheerio = require('cheerio');

class WebScraper {
    async scrape(url) {
        try {
            const response = await axios.get(url);
            const $ = cheerio.load(response.data);
            
            // Remove scripts, styles, and other non-content elements
            $('script').remove();
            $('style').remove();
            $('nav').remove();
            $('header').remove();
            $('footer').remove();
            
            // Get main content
            const content = $('main, article, .content, #content').text() || $('body').text();
            
            return content.trim();
        } catch (error) {
            console.error('WebScraper scrape error:', error);
            throw error;
        }
    }
}

module.exports = { WebScraper }; 