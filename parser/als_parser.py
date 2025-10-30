import gzip
import xml.etree.ElementTree as ET
import sys
from pathlib import Path
from collections import Counter
from typing import Dict


def open_als_xml(path:Path) -> ET.ElementTree:
    with gzip.open(path, 'rb') as f:
        return ET.parse(f)
        
def als_inspect(path: Path) -> Dict[str, int]:
    """
    Produce a rough frequency summary of XML element paths to guide schema mapping.
    Safe to run on any ALS without knowing its exact schema.
    """
    tree = open_als_xml(path)
    root = tree.getroot()
    counter: Counter[str] = Counter()

    def walk(node, path):
        tag = node.tag.split("}")[-1]  # strip namespace if present
        here = f"{path}/{tag}" if path else tag
        counter[here] += 1
        for child in list(node):
            walk(child, here)

    walk(root, "")
    return dict(counter)

def parse_als_with_values(file_path):
    tree = open_als_xml(file_path)
    root = tree.getroot()
    
    def extract_with_values(element, path="", level=0):
        current_path = f"{path}/{element.tag}" if path else element.tag
        
        # Print element with its text content if it has any
        if element.text and element.text.strip():
            print(f"{'  ' * level}{current_path}: {element.text.strip()}")
        else:
            print(f"{'  ' * level}{current_path}")
            
        # Print attributes if any
        if element.attrib:
            for attr, value in element.attrib.items():
                print(f"{'  ' * (level+1)}@{attr}: {value}")
        
        for child in element:
            extract_with_values(child, current_path, level + 1)
    
    extract_with_values(root)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        result = parse_als_with_values(Path(sys.argv[1]))
        print(result)
    else:
        print("Usage: python als_parser.py <path_to_als_file>")