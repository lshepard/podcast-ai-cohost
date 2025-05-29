from typing import Dict, Optional, Tuple
import os
import logging
import asyncio
from urllib.parse import urlparse

from tenacity import retry, stop_after_attempt, wait_exponential
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator
from crawl4ai.content_filter_strategy import PruningContentFilter, BM25ContentFilter

from app.lib.llm import generate_response
from app.lib.pdf import process_pdf_url

logger = logging.getLogger(__name__)

browser_config = BrowserConfig(
    headless=True,  
    verbose=True,
)

run_config = CrawlerRunConfig(
    cache_mode=CacheMode.ENABLED,
    markdown_generator=DefaultMarkdownGenerator(
        content_filter=PruningContentFilter(threshold=0.48, threshold_type="fixed", min_word_threshold=0)
    )
)

def is_pdf_url(url: str) -> bool:
    """Check if the URL points to a PDF file.
    
    Args:
        url: The URL to check
        
    Returns:
        True if the URL ends with .pdf, False otherwise
    """
    parsed_url = urlparse(url)
    return parsed_url.path.lower().endswith('.pdf')

@retry(wait=wait_exponential(min=1, max=10), stop=stop_after_attempt(3))
async def scrape_webpage(url: str) -> Tuple[bool, str, Optional[str], Optional[str], Optional[str]]:
    """Scrape a webpage or PDF and extract its content and summary.
    
    Args:
        url: The URL to scrape
        
    Returns:
        Tuple of (success, message, title, content, summary)
    """
    try:
            async with AsyncWebCrawler(config=browser_config) as crawler:
                crawl_result = await crawler.arun(url=url, config=run_config)
                if not crawl_result:
                    logger.error("No response from Crawl4AI")
                    return False, "No response from Crawl4AI", None, None, None
                
                # Get content type from response headers
                content_type = crawl_result.response_headers.get('content-type', '').lower() if hasattr(crawl_result, 'response_headers') else ''
                is_pdf_by_content_type = "application/pdf" in content_type
                is_pdf_by_url = is_pdf_url(url)
        
                # If it's a PDF by content type, process as PDF
                if is_pdf_by_content_type or is_pdf_by_url:
                    success, message, content, summary = await process_pdf_url(url)
                    if not success:
                        return False, message, None, None, None
                    return True, "PDF processed successfully", None, content, summary
                
                # Process as normal webpage
                if not hasattr(crawl_result, 'markdown') or not crawl_result.markdown:
                    logger.error(f"Invalid or empty markdown from Crawl4AI: {crawl_result}")
                    return False, "Invalid or empty markdown from Crawl4AI", None, None, None
                
                content = crawl_result.markdown.strip()
                if not content:
                    logger.error("No meaningful content extracted from the webpage")
                    return False, "No meaningful content extracted from the webpage", None, None, None
                
                title = crawl_result.metadata.get("title")
                summary_prompt = f"""Write a summary of this content, including anything relevant to AI or education. 
Include names of businesses, products, people and other entities that are relevant.

Content:
{content}
"""
                try:
                    summary = await generate_response(summary_prompt)
                    return True, "Content scraped successfully", title, content, summary
                except Exception as e:
                    logger.error(f"Error generating summary: {str(e)}")
                    return False, f"Error generating summary: {str(e)}", title, content, None

    except Exception as e:
        logger.error(f"Error scraping content: {str(e)}")
        return False, f"Error scraping content: {str(e)}", "Scraping error", None, None

async def process_web_source(url: str) -> Dict:
    """Process a web source by scraping and summarizing it.
    
    Args:
        url: The URL to process
        
    Returns:
        Dictionary with content and summary
    """
    # Scrape the webpage
    success, message, title, content, summary = await scrape_webpage(url)
    if not success:
        return {
            'success': False,
            'error': message,
            'content': None,
            'summary': None,
            'title': None,
            'source_type': 'pdf' if is_pdf_url(url) else 'web'
        }
    
    return {
        'success': True,
        'content': content,
        'summary': summary,
        'title': title or content.split('\n')[0] if content else url,  # Use first line of content as title, fallback to URL
        'source_type': 'pdf' if is_pdf_url(url) else 'web'
    } 