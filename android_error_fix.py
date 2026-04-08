import subprocess
import requests

MODEL = "qwen2.5-coder:1.5b"

def ask_ai(error_text):
    prompt = f"""
You are an Android Kotlin expert.

Fix the following Android Studio build error.
Explain the cause and provide the corrected code.

ERROR:
{error_text}
"""

    response = requests.post(
        "http://localhost:11434/api/generate",
        json={
            "model": MODEL,
            "prompt": prompt,
            "stream": False
        }
    )

    return response.json()["response"]


def run_build():

    print("Running Gradle build...\n")

    result = subprocess.run(
        ["gradlew", "assembleDebug"],
        capture_output=True,
        text=True,
        shell=True
    )

    return result.stderr


if __name__ == "__main__":

    error = run_build()

    if "FAILURE" in error:

        print("\nBuild failed. Asking AI to fix...\n")

        fix = ask_ai(error)

        print("AI Suggested Fix:\n")
        print(fix)

    else:

        print("Build successful!")