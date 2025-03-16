#!/usr/bin/env python3
import os
import json
import time
import pandas as pd
from anthropic import Anthropic
from tqdm import tqdm
import random

# Configuration
TOTAL_PROMPTS = 3000  # Updated from 10,000 to 3,000 as per your request
BATCH_SIZE = 1       # Number of prompt-code pairs per API call
MAX_RETRIES = 3       # Maximum retries for API failures
DELAY_BETWEEN_REQUESTS = 2  # Seconds between requests for rate limiting
OUTPUT_FILE = "animation_prompts.xlsx"  # Final output file
CLAUDE_API_KEY = os.environ.get("CLAUDE_API_KEY")  # API key from environment variable
OUTPUT_JSON = "combined_data_2.json"  # Intermediate JSON backup file

# Validate API key
if not CLAUDE_API_KEY:
    raise ValueError("Please set the CLAUDE_API_KEY environment variable")

# Initialize Anthropic client
client = Anthropic(api_key=CLAUDE_API_KEY)

# Helper function to generate random DSA elements for prompt inspiration
def get_random_elements():
    """Returns a dictionary of random DSA elements to inspire diverse prompts."""
    data_structures = [
        "array", "linked list", "stack", "queue", "hash table", "binary tree",
        "heap", "graph", "trie", "B-tree", "AVL tree", "red-black tree",
        "segment tree", "Fenwick tree", "disjoint set", "priority queue",
        "deque", "circular buffer", "skip list", "bloom filter"
    ]
    
    algorithms = [
        "binary search", "depth-first search", "breadth-first search", "quicksort",
        "merge sort", "dynamic programming", "greedy algorithm", "dijkstra's algorithm",
        "bellman-ford", "A* search", "kruskal's algorithm", "prim's algorithm",
        "topological sort", "floyd-warshall", "knuth-morris-pratt", "rabin-karp",
        "binary exponentiation", "kadane's algorithm", "flood fill", "union find"
    ]
    
    operations = [
        "insertion", "deletion", "search", "traversal", "rotation", "balancing",
        "splitting", "merging", "mapping", "reducing", "filtering", "hashing",
        "collision resolution", "path finding", "sorting", "heapify",
        "backtracking", "memoization", "pruning", "rebalancing"
    ]
    
    complexity_themes = [
        "time complexity analysis", "space complexity analysis", "amortized analysis",
        "worst-case scenario", "average-case analysis", "big O notation",
        "algorithmic efficiency", "computational complexity",
        "performance comparison", "optimization techniques"
    ]
    
    return {
        "data_structure": random.choice(data_structures),
        "algorithm": random.choice(algorithms),
        "operation": random.choice(operations),
        "complexity_theme": random.choice(complexity_themes)
    }

# Function to generate a batch of prompt-code pairs
def generate_batch():
    """Generate a batch of unique prompt-code pairs using the Anthropic SDK."""
    elements = [get_random_elements() for _ in range(BATCH_SIZE)]
    prompt = f"""Generate exactly {BATCH_SIZE} unique and diverse Manim animation prompts focused on Data Structures and Algorithms (DSA), each with corresponding Python code. For each prompt:

1. Create a clear, descriptive prompt for visualizing a DSA concept or process.
2. Write working Manim code (Python) that implements the prompt.

Each animation should help viewers understand key DSA concepts through clear visualization.
Ensure the Python code is correct, working Manim code that would render properly.
Make sure each prompt and code pair is distinct from the others in this batch.

Return the results as a valid JSON array with objects containing 'prompt' and 'code' fields, and nothing else outside the array:
[
  {{
    "prompt": "Your DSA animation prompt here",
    "code": "Python Manim code here"
  }},
  ...
]

Here are some DSA elements for inspiration (feel free to go beyond these):
{json.dumps(elements, indent=2)}
"""
    
    for attempt in range(MAX_RETRIES):
        try:
            response = client.messages.create(
                model="claude-3-7-sonnet-20250219",  # Your requested version 3.7
                max_tokens=8192,            # Increased to maximum to avoid truncation
                temperature=0.9,            # For creative diversity
                messages=[{"role": "user", "content": prompt}]
            )
            content = response.content[0].text
            # Log raw response for debugging
            print(f"Raw response: {content[:200]}...")
            # Extract JSON array from response
            json_start = content.find("[")
            json_end = content.rfind("]") + 1
            if json_start != -1 and json_end != -1:
                json_str = content[json_start:json_end]
                try:
                    result_items = json.loads(json_str)
                except json.JSONDecodeError as e:
                    print(f"JSON parsing error: {e}")
                    # Attempt to fix common JSON issues
                    fixed_json = json_str.replace('\\\\\\', '\\').replace('\\"', '"').replace('"\\', '"')
                    try:
                        result_items = json.loads(fixed_json)
                        print("Successfully parsed JSON after fixes")
                    except json.JSONDecodeError as e:
                        print(f"Failed to parse JSON after fixes: {json_str[:100]}... Error: {e}")
                        result_items = []
            else:
                print("No valid JSON array found in response")
                result_items = []
            # Filter for valid items with both 'prompt' and 'code'
            valid_items = [
                item for item in result_items 
                if isinstance(item, dict) and 'prompt' in item and 'code' in item
            ]
            if len(valid_items) == BATCH_SIZE:
                return valid_items
            else:
                print(f"Batch incomplete: Expected {BATCH_SIZE}, got {len(valid_items)}")
        except Exception as e:
            print(f"Error on attempt {attempt + 1}/{MAX_RETRIES}: {e}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(DELAY_BETWEEN_REQUESTS)
    print("All retries failed for this batch")
    return []

# Main execution function
def main():
    """Generate 3,000 unique DSA prompts and Manim code pairs."""
    all_data = []          # List to store all prompt-code pairs
    unique_prompts = set() # Set to track unique prompts
    
    # Load existing data if available
    if os.path.exists(OUTPUT_JSON):
        try:
            with open(OUTPUT_JSON, 'r') as f:
                all_data = json.load(f)
            unique_prompts = set(item['prompt'] for item in all_data if 'prompt' in item)
            print(f"Resuming from {len(unique_prompts)} existing unique prompts")
        except Exception as e:
            print(f"Error loading existing data: {e}. Starting fresh.")
            all_data = []
    
    # Progress bar for tracking
    with tqdm(total=TOTAL_PROMPTS, initial=len(unique_prompts)) as pbar:
        while len(unique_prompts) < TOTAL_PROMPTS:
            batch_data = generate_batch()
            duplicates = 0
            for item in batch_data:
                prompt = item['prompt']
                if prompt not in unique_prompts:
                    unique_prompts.add(prompt)
                    all_data.append(item)
                    pbar.update(1)
                    if len(unique_prompts) >= TOTAL_PROMPTS:
                        break
                else:
                    duplicates += 1
            if duplicates > 0:
                print(f"Found {duplicates} duplicates in batch")
            # Save progress after each batch
            with open(OUTPUT_JSON, 'w') as f:
                json.dump(all_data, f, indent=2)
            time.sleep(DELAY_BETWEEN_REQUESTS)  # Rate limiting delay
    
    # Save final results to Excel
    df = pd.DataFrame(all_data)
    df.to_excel(OUTPUT_FILE, index=False)
    print(f"Successfully generated {len(unique_prompts)} unique prompts and saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()