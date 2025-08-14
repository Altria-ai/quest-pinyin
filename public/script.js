document.addEventListener('DOMContentLoaded', () => {
    // --- 元素获取 ---
    const keyboardContainer = document.getElementById('keyboard-container');
    const pinyinDisplay = document.getElementById('pinyin-display');
    const candidatesContainer = document.getElementById('candidates-container');
    const outputText = document.getElementById('output-text');
    const clearBtn = document.getElementById('clear-btn');
    const copyBtn = document.getElementById('copy-btn');
    const backspaceBtn = document.getElementById('backspace-btn');

    // --- 状态变量 ---
    let currentPinyin = '';
    let loadedDict = {}; // 缓存已加载的词典

    // --- 键盘布局 ---
    const keyLayout = [
        ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
        ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
        ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
        ['Backspace', 'Space', 'Enter']
    ];

    // --- 功能函数 ---
    /**
     * 【核心新增】检查一个拼音字符串是否在词典中存在
     * @param {string} pinyin - 要检查的拼音.
     * @returns {Promise<boolean>}
     */
    async function isPinyinValid(pinyin) {
        if (!pinyin) return false;
        const firstChar = pinyin[0];
        await loadDictionary(firstChar);
        const pinyinData = loadedDict[firstChar];
        return pinyinData && pinyinData[pinyin];
    }

    /**
     * 【核心新增】使用最大正向匹配法分割拼音字符串
     * @param {string} pinyinStr - 完整的拼音字符串.
     * @returns {Promise<string[]>} - 分割后的拼音数组.
     */
    async function segmentPinyin(pinyinStr) {
        const segments = [];
        let currentIndex = 0;
        const maxSyllableLength = 6; // 拼音最长音节长度 (如 zhuang)

        while (currentIndex < pinyinStr.length) {
            let found = false;
            // 从长到短尝试匹配
            for (let len = maxSyllableLength; len >= 1; len--) {
                const sub = pinyinStr.substr(currentIndex, len);
                if (await isPinyinValid(sub)) {
                    segments.push(sub);
                    currentIndex += len;
                    found = true;
                    break;
                }
            }
            // 如果一个字符都匹配不上，说明后续输入有误，停止分割
            if (!found) {
                break;
            }
        }
        return segments;
    }

    /**
     * 【核心新增】获取单个拼音对应的首选汉字
     * @param {string} pinyin - 单个拼音.
     * @returns {Promise<string|null>}
     */
    async function getTopWord(pinyin) {
        if (!pinyin) return null;
        const firstChar = pinyin[0];
        await loadDictionary(firstChar);
        const pinyinData = loadedDict[firstChar];
        if (pinyinData && pinyinData[pinyin] && pinyinData[pinyin][0]) {
            return pinyinData[pinyin][0];
        }
        return null;
    }

    /**
     * 【重写】更新候选词区域的逻辑，集成句子生成
     */
    async function updateCandidates() {
        candidatesContainer.innerHTML = '';
        if (!currentPinyin) return;

        let finalCandidates = new Set();

        // --- 1. 句子生成 ---
        const segments = await segmentPinyin(currentPinyin);
        if (segments.length > 1) {
            // 使用 Promise.all 并行获取所有音节的首选汉字
            const topWords = await Promise.all(segments.map(p => getTopWord(p)));
            // 过滤掉可能存在的 null (获取失败的音节)
            const sentence = topWords.filter(word => word).join('');
            if (sentence) {
                finalCandidates.add(sentence);
            }
        }
        
        // --- 2. 传统前缀匹配 (用于词组和单字) ---
        const firstChar = currentPinyin[0];
        await loadDictionary(firstChar);
        const pinyinData = loadedDict[firstChar];
        if (pinyinData) {
            let prefixWords = [];
            for (const pinyin in pinyinData) {
                if (pinyin.startsWith(currentPinyin)) {
                    prefixWords.push(...pinyinData[pinyin]);
                }
            }
            // 对前缀匹配结果进行智能排序并截取
            const sortedPrefixWords = [...new Set(prefixWords)] // 去重
                .sort((a, b) => a.length - b.length) // 按长度排序
                .slice(0, 20); // 取前20个
            
            sortedPrefixWords.forEach(word => finalCandidates.add(word));
        }

        // --- 3. 渲染最终候选列表 ---
        if (finalCandidates.size === 0) {
            // 如果没有任何候选，可以显示原始英文字符串作为候选
            candidatesContainer.innerHTML = `<div class="candidate-item fallback">${currentPinyin}</div>`;
        } else {
            finalCandidates.forEach(word => {
                const candidateElement = document.createElement('div');
                candidateElement.classList.add('candidate-item');
                candidateElement.textContent = word;
                candidateElement.addEventListener('click', () => selectCandidate(word));
                candidatesContainer.appendChild(candidateElement);
            });
        }
    }

    function createKeyboard() {
        keyboardContainer.innerHTML = '';
        keyLayout.forEach(row => {
            const rowElement = document.createElement('div');
            rowElement.classList.add('keyboard-row');
            
            row.forEach(key => {
                const keyElement = document.createElement('div');
                keyElement.classList.add('key');
                keyElement.textContent = key;
                keyElement.dataset.key = key;

                if (key.length > 1) {
                    keyElement.classList.add('special-key');
                    keyElement.classList.add(`key-${key.toLowerCase()}`);
                }
                rowElement.appendChild(keyElement);
            });
            keyboardContainer.appendChild(rowElement);
        });
    }

    async function loadDictionary(firstChar) {
        if (!firstChar || loadedDict[firstChar]) {
            return;
        }
        try {
            const response = await fetch(`dict/${firstChar}.json`);
            if (!response.ok) throw new Error('Dictionary not found');
            loadedDict[firstChar] = await response.json();
        } catch (error) {
            console.error(error);
            loadedDict[firstChar] = null; // 标记为加载失败，避免重试
        }
    }

  
    function selectCandidate(word) {
        outputText.value += word;
        currentPinyin = '';
        pinyinDisplay.textContent = '';
        candidatesContainer.innerHTML = '';
        outputText.focus();
    }

    function handleKeyPress(key) {
        switch (key) {
            case 'Backspace':
                currentPinyin = currentPinyin.slice(0, -1);
                break;
            case 'Enter':
                selectCandidate(currentPinyin); 
                return;
            case 'Space':
                const firstCandidate = candidatesContainer.querySelector('.candidate-item');
                if (firstCandidate) {
                    firstCandidate.click();
                } else {
                    selectCandidate(' '); // 如果没有候选词，输入空格
                }
                return;
            default:
                if (currentPinyin.length < 15) { // 限制拼音最大长度
                    currentPinyin += key;
                }
                break;
        }

        pinyinDisplay.textContent = currentPinyin;
        updateCandidates();
    }

    // --- 事件监听 ---
    keyboardContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('key')) {
            const key = event.target.dataset.key;
            handleKeyPress(key);
        }
    });

    clearBtn.addEventListener('click', () => {
        outputText.value = '';
        outputText.focus();
    });

    copyBtn.addEventListener('click', () => {
        if (!outputText.value) return;

        navigator.clipboard.writeText(outputText.value).then(() => {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '已复制!';
            copyBtn.disabled = true;
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.disabled = false;
            }, 2000);
        }).catch(err => {
            console.error('复制失败: ', err);
            alert('复制失败，您的浏览器可能不支持或权限不足。');
        });
    });

    backspaceBtn.addEventListener('click', () => {
        // 使用 slice(0, -1) 来移除字符串的最后一个字符
        outputText.value = outputText.value.slice(0, -1);
        outputText.focus();
    });

    // --- 初始化 ---
    createKeyboard();
    outputText.focus();
});