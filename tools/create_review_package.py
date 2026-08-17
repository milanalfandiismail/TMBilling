import sys
import os
import subprocess

def run_git(args):
    res = subprocess.run(["git"] + args, capture_output=True, text=True, encoding="utf-8", check=True)
    return res.stdout

def main():
    if len(sys.argv) < 4:
        print("Usage: create_review_package.py PLAN_FILE BASE HEAD [OUTFILE]")
        sys.exit(1)

    plan_file = sys.argv[1]
    base = sys.argv[2]
    head = sys.argv[3]

    if not os.path.exists(plan_file):
        print(f"No such plan file: {plan_file}")
        sys.exit(1)

    # Resolve short hashes
    base_short = run_git(["rev-parse", "--short", base]).strip()
    head_short = run_git(["rev-parse", "--short", head]).strip()

    slug = os.path.splitext(os.path.basename(plan_file))[0]
    
    if len(sys.argv) == 5:
        outfile = sys.argv[4]
    else:
        outfile = f"C:\\Project GIT\\TMBilling\\.superpowers\\sdd\\{slug}\\review-{base_short}..{head_short}.diff"

    commits_log = run_git(["log", "--oneline", f"{base}..{head}"])
    diff_stat = run_git(["diff", "--stat", f"{base}..{head}"])
    diff_full = run_git(["diff", "-U10", f"{base}..{head}"])
    
    commits_count = len(run_git(["rev-list", f"{base}..{head}"]).splitlines())

    os.makedirs(os.path.dirname(outfile), exist_ok=True)
    with open(outfile, 'w', encoding='utf-8') as f:
        f.write(f"# Review package: {base}..{head}\n\n")
        f.write("## Commits\n")
        f.write(commits_log + "\n\n")
        f.write("## Files changed\n")
        f.write(diff_stat + "\n\n")
        f.write("## Diff\n")
        f.write(diff_full + "\n")

    print(f"Wrote review package to {outfile}: {commits_count} commit(s)")

if __name__ == "__main__":
    main()
