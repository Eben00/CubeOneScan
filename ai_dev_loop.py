import subprocess
import requests
import os
import time

MODEL = "qwen2.5-coder:3b"

PROJECT = r"C:\AI\cubeonescan_project"
SOURCE = r"C:\AI\cubeonescan_project\app\src\main\java\com\cubeone\scan"

OLLAMA_URL = "http://localhost:11434/api/generate"


def ask_ai(prompt):

    r = requests.post(
        OLLAMA_URL,
        json={
            "model": MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {
                "num_ctx": 512,
                "temperature": 0.2
            }
        },
    )

    return r.json()["response"]


def write_file(name, code):

    path = os.path.join(SOURCE, name)

    with open(path, "w", encoding="utf-8") as f:
        f.write(code)

    print("AI wrote:", name)


def run_build():

    print("Running Gradle build...")

    result = subprocess.run(
        ["gradlew.bat", "assembleDebug"],
        cwd=PROJECT,
        capture_output=True,
        text=True
    )

    return result.stdout + result.stderr


def autonomous_loop():

    feature = """
Create a Kotlin Android barcode scanner activity using ZXing.
The class should be called BarcodeScannerActivity.
"""

    code = ask_ai(feature)

    write_file("BarcodeScannerActivity.kt", code)

    max_attempts = 5
    attempt = 0

    while attempt < max_attempts:

        output = run_build()

        if "BUILD SUCCESSFUL" in output:
            print("\n✅ BUILD SUCCESSFUL")
            break

        print("\nBuild failed, AI fixing...")

        error_log = "\n".join(output.splitlines()[-200:])

        fix_prompt = f"""
The Android Gradle build failed with this error:

{error_log}

Fix the Kotlin code and return the corrected file only.
"""

        fixed_code = ask_ai(fix_prompt)

        write_file("BarcodeScannerActivity.kt", fixed_code)

        attempt += 1

        time.sleep(2)

    if attempt == max_attempts:
        print("\nAI failed to fix the build after 5 attempts.")


autonomous_loop()