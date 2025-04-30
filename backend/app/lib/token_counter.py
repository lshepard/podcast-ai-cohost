import tiktoken

def count_tokens(text: str, model: str = "gpt-4") -> int:
    """Count the number of tokens in a text string using tiktoken.
    
    Args:
        text: The text to count tokens for
        model: The model to use for tokenization (default: gpt-4)
        
    Returns:
        The number of tokens in the text
    """
    try:
        encoding = tiktoken.encoding_for_model(model)
        return len(encoding.encode(text))
    except KeyError:
        # Fallback to cl100k_base encoding if model not found
        encoding = tiktoken.get_encoding("cl100k_base")
        return len(encoding.encode(text)) 