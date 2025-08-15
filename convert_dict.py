# convert_dict.py (修改版，生成单个合并文件)
import yaml
from collections import defaultdict
import os
import json

# --- 配置 ---
# 【核心修正】调整文件处理顺序，优先处理高质量的单字库。
DICT_FILES = [
    {'path': '8105.dict.yaml', 'type': 'char'},       # 常用字库最优先
    {'path': '41448.dict.yaml', 'type': 'char_rare'}, # 罕用字库其次
    {'path': 'base.dict.yaml', 'type': 'word'},      # 综合词库最后处理
]
OUTPUT_DIR = 'public/dict'

# --- 核心逻辑 (这部分完全不变) ---

def process_file(file_path, pinyin_map, processed_entries):
    """
    处理单个词库文件，提取词、拼音和权重。
    """
    print(f"--- 正在处理文件: {file_path} ---")
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except FileNotFoundError:
        print(f"    错误: 找不到文件 {file_path}，已跳过。")
        return

    count = 0
    error_count = 0
    for line_num, line in enumerate(lines, 1):
        if not line.strip() or '\t' not in line:
            continue

        parts = line.strip().split('\t')
        
        if len(parts) < 2:
            if error_count < 5:
                print(f"    警告: 在文件 {file_path} 第 {line_num} 行格式不正确，已跳过。内容: '{line.strip()}'")
            error_count += 1
            continue
        
        word = parts[0]
        pinyin = parts[1].replace(' ', '')
        
        if not word or not pinyin:
            continue

        weight_str = parts[2] if len(parts) > 2 else '1'
        
        try:
            weight = int(weight_str)
        except ValueError:
            if error_count < 5:
                print(f"    警告: 在文件 {file_path} 第 {line_num} 行发现无效权重 '{weight_str}'，已跳过。")
            error_count += 1
            continue

        entry_key = word + pinyin
        if entry_key in processed_entries:
            continue

        pinyin_map[pinyin].append([word, weight])
        processed_entries.add(entry_key)
        count += 1

    print(f"处理完成，新增 {count} 个有效条目。")
    if error_count > 0:
        print(f"共发现并跳过了 {error_count} 个格式错误的条目。")


def convert_all():
    """
    转换所有在 DICT_FILES 中定义的词库文件。
    """
    pinyin_map = defaultdict(list)
    processed_entries = set()

    for file_info in DICT_FILES:
        process_file(file_info['path'], pinyin_map, processed_entries)
            
    print("\n--- 开始排序和生成最终文件 ---")
    split_dicts = defaultdict(dict)
    
    for pinyin, candidates in pinyin_map.items():
        if not pinyin:
            continue
            
        sorted_candidates = sorted(candidates, key=lambda item: (len(item[0]), -item[1]))
        final_word_list = [item[0] for item in sorted_candidates]
        
        first_char = pinyin[0]
        if first_char.isalpha():
            split_dicts[first_char][pinyin] = final_word_list
        
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        print(f"已创建输出目录: {OUTPUT_DIR}")
        
    # --- 【核心修改点】 ---
    # 之前是循环写入多个文件，现在我们只写入一个合并后的大文件。
    
    # 1. 定义合并后文件的完整路径
    output_path = os.path.join(OUTPUT_DIR, 'dict.json')
    
    # 2. 将整个 split_dicts 对象一次性写入
    with open(output_path, 'w', encoding='utf-8') as f:
        # 使用 split_dicts 这个包含了所有字母数据的完整字典
        json.dump(split_dicts, f, ensure_ascii=False)

    print(f"\n转换成功！合并后的主字典文件已保存到 '{output_path}'。")


if __name__ == '__main__':
    convert_all()