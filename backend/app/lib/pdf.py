from typing import Dict, Optional, Tuple, Union
import os
import logging
from tempfile import NamedTemporaryFile
import requests
import nest_asyncio
import json

from app.lib.llm import generate_response
from llama_parse import LlamaParse

# Apply nest_asyncio to allow nested event loops
nest_asyncio.apply()

logger = logging.getLogger(__name__)

# Initialize LlamaParse with your API key
LLAMA_PARSE_API_KEY = os.getenv("LLAMA_PARSE_API_KEY")
if not LLAMA_PARSE_API_KEY:
    raise ValueError("LLAMA_PARSE_API_KEY environment variable is not set")

# Define parsing instruction for better content extraction
PARSING_INSTRUCTION = """
Extract the main content from this PDF, focusing on:
1. Main text content and headings
2. Any tables or structured data
3. Important figures and their captions
4. References and citations
5. Key points and conclusions

Format the output in markdown, preserving the document's structure and hierarchy.
"""

async def download_pdf(url: str) -> Tuple[bool, str, Optional[str]]:
    """Download a PDF file from a URL.
    
    Args:
        url: The URL of the PDF to download
        
    Returns:
        Tuple of (success, message, temp_file_path)
    """
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        # Create a temporary file to store the PDF
        with NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            for chunk in response.iter_content(chunk_size=8192):
                temp_file.write(chunk)
            
            return True, "PDF downloaded successfully", temp_file.name
            
    except Exception as e:
        logger.error(f"Error downloading PDF: {str(e)}")
        return False, f"Error downloading PDF: {str(e)}", None

async def parse_pdf_with_llamaparse(pdf_path: str) -> Tuple[bool, str, Optional[str], Optional[str]]:
    """Parse a PDF file using LlamaParse and generate a summary.
    
    Args:
        pdf_path: Path to the PDF file
        
    Returns:
        Tuple of (success, message, content, summary)
    """
    try:
        # Initialize LlamaParse with Gemini
        parser = LlamaParse(
            result_type="markdown",
            use_vendor_multimodal_model=True,
            vendor_multimodal_model_name="gemini-2.0-flash-001",
            invalidate_cache=True,
            parsing_instruction=PARSING_INSTRUCTION,
            api_key=LLAMA_PARSE_API_KEY
        )
        
        # Parse the PDF using async method
        try:
            documents = await parser.aload_data(pdf_path)
        except Exception as e:
            # Log the full error details
            error_details = {
                "error_type": type(e).__name__,
                "error_message": str(e),
                "error_args": e.args if hasattr(e, 'args') else None,
                "error_dict": e.__dict__ if hasattr(e, '__dict__') else None
            }
            logger.error(f"LlamaParse API error details: {json.dumps(error_details, indent=2, default=str)}")
            raise
        
        if not documents:
            return False, "No content extracted from PDF", None, None
            
        # Combine all document content
        content = "\n\n".join([doc.text for doc in documents])
        if not content.strip():
            return False, "No meaningful content extracted from PDF", None, None
            
        # Generate summary using LLM
        summary_prompt = f"""Write a summary of this PDF content, including anything relevant to AI or education. 
Include names of businesses, products, people and other entities that are relevant.

Content:
{content}
"""
        try:
            summary = await generate_response(summary_prompt)
            return True, "PDF processed successfully", content, summary
        except Exception as e:
            logger.error(f"Error generating summary: {str(e)}")
            return False, f"Error generating summary: {str(e)}", content, None
            
    except Exception as e:
        error_msg = f"Error processing PDF: {str(e)}"
        logger.error(error_msg)
        # Log the full error details
        error_details = {
            "error_type": type(e).__name__,
            "error_message": str(e),
            "error_args": e.args if hasattr(e, 'args') else None,
            "error_dict": e.__dict__ if hasattr(e, '__dict__') else None
        }
        logger.error(f"Full error details: {json.dumps(error_details, indent=2, default=str)}")
        return False, error_msg, None, None

async def process_pdf(pdf_path: str) -> Tuple[bool, str, Optional[str], Optional[str]]:
    """Process a PDF file and generate a summary.
    
    Args:
        pdf_path: Path to the PDF file
        
    Returns:
        Tuple of (success, message, content, summary)
    """
    try:
        return await parse_pdf_with_llamaparse(pdf_path)
    finally:
        # Clean up the temporary file if it's a downloaded file
        if pdf_path.startswith('/tmp/'):
            try:
                os.unlink(pdf_path)
            except Exception as e:
                logger.warning(f"Error deleting temporary PDF file: {str(e)}")

async def process_pdf_url(url: str) -> Tuple[bool, str, Optional[str], Optional[str]]:
    """Process a PDF from a URL by downloading and processing it.
    
    Args:
        url: URL of the PDF to process
        
    Returns:
        Tuple of (success, message, content, summary)
    """
    # Download the PDF
    success, message, pdf_path = await download_pdf(url)
    if not success:
        return False, message, None, None
        
    # Process the downloaded PDF
    return await process_pdf(pdf_path)

async def process_pdf_source(file_path: str) -> dict:
    """Process a PDF file and extract its content and summary.
    
    Args:
        file_path: Path to the PDF file
        
    Returns:
        dict: Dictionary containing success status, content, and summary
    """
    success, message, content, summary = await parse_pdf_with_llamaparse(file_path)
    
    if not success:
        return {
            "success": False,
            "error": message
        }
        
    return {
        "success": True,
        "content": content,
        "summary": summary
    } 