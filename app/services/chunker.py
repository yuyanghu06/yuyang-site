from langchain.text_splitter import RecursiveCharacterTextSplitter

_splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50,
    length_function=len,
)


def chunk_text(text: str) -> list[str]:
    text = " ".join(text.split())  # normalize whitespace
    return _splitter.split_text(text)
