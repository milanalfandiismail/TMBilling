import sys
import os
import re

def main():
    if len(sys.argv) < 3:
        print("Usage: extract_brief.py PLAN_FILE TASK_NUMBER [OUTFILE]")
        sys.exit(1)

    plan_file = sys.argv[1]
    task_num = sys.argv[2]
    
    if not os.path.exists(plan_file):
        print(f"No such plan file: {plan_file}")
        sys.exit(1)

    slug = os.path.splitext(os.path.basename(plan_file))[0]
    
    if len(sys.argv) == 4:
        outfile = sys.argv[3]
    else:
        # Default path
        outfile = f"C:\\Project GIT\\TMBilling\\.superpowers\\sdd\\{slug}\\task-{task_num}-brief.md"

    with open(plan_file, 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.splitlines()
    in_fence = False
    in_task = False
    task_lines = []

    # Match lines like "### Task N: ..." or "## Task N: ..." but not inside backticks
    task_header_pat = re.compile(r'^#+\s+Task\s+(\d+)(?:\D|$)')

    for line in lines:
        if line.strip().startswith("```"):
            in_fence = not in_fence
        
        if not in_fence:
            m = task_header_pat.match(line)
            if m:
                current_num = m.group(1)
                if current_num == task_num:
                    in_task = True
                else:
                    in_task = False

        if in_task:
            task_lines.append(line)

    if not task_lines:
        print(f"Task {task_num} not found in {plan_file}")
        sys.exit(1)

    os.makedirs(os.path.dirname(outfile), exist_ok=True)
    with open(outfile, 'w', encoding='utf-8') as f:
        f.write("\n".join(task_lines) + "\n")

    print(f"Wrote brief to {outfile}")

if __name__ == "__main__":
    main()
