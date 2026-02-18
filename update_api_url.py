#!/usr/bin/env python3
import fileinput
import sys

# Define the file path
file_path = 'c:\\Users\\howto\\Documents\\GitHub\\MY-FIRST-AI-APP\\app.js'

# Read the file and make the replacement
with fileinput.FileInput(file_path, inplace=True) as file:
    for line in file:
        if "this.apiUrl = 'http://localhost:3000/api';" in line:
            print("        // Use dynamic API URL for production deployment")
            print("        this.apiUrl = window.location.hostname === 'localhost' or window.location.hostname === '127.0.0.1' ? 'http://localhost:3000/api' : `${window.location.origin}/api`;")
        else:
            print(line, end='')