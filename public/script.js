document.addEventListener('DOMContentLoaded', () => {
    // --- 元素获取 (无变化) ---
    const keyboardContainer = document.getElementById('keyboard-container');
    const pinyinDisplay = document.getElementById('pinyin-display');
    const candidatesContainer = document.getElementById('candidates-container');
    const outputText = document.getElementById('output-text');
    const clearBtn = document.getElementById('clear-btn');
    const copyBtn = document.getElementById('copy-btn');
    const backspaceBtn = document.getElementById('backspace-btn');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const body = document.body;

    // --- 状态变量等 (无变化) ---
    let currentPinyin = '';
    let loadedDict = {};
    const sunIcon = '☀️';
    const moonIcon = '🌙';
    function applyTheme(theme) {
        if (theme === 'light') {
            body.classList.add('light-mode');
            themeToggleBtn.textContent = moonIcon;
        } else {
            body.classList.remove('light-mode');
            themeToggleBtn.textContent = sunIcon;
        }
    }
    const keyLayout = [
        ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
        ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
        ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
        ['Backspace', 'Space', 'Enter']
    ];
    async function preloadAllDictionaries() {
        console.log("开始预加载所有字典...");
        const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
        const promises = alphabet.map(char => loadDictionary(char));
        try {
            await Promise.all(promises);
            console.log("所有字典预加载完成！");
        } catch (error) {
            console.error("预加载字典时发生错误:", error);
        }
    }
    async function isPinyinValid(pinyin) {
        if (!pinyin) return false;
        const firstChar = pinyin[0];
        await loadDictionary(firstChar);
        const pinyinData = loadedDict[firstChar];
        return pinyinData && pinyinData[pinyin];
    }
    async function segmentPinyin(pinyinStr) {
        const segments = [];
        let currentIndex = 0;
        const maxSyllableLength = 6;
        while (currentIndex < pinyinStr.length) {
            let found = false;
            for (let len = maxSyllableLength; len >= 1; len--) {
                const sub = pinyinStr.substr(currentIndex, len);
                if (await isPinyinValid(sub)) {
                    segments.push(sub);
                    currentIndex += len;
                    found = true;
                    break;
                }
            }
            if (!found) break;
        }
        return segments;
    }
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
     * 【核心修改】重写候选词生成逻辑，采用“精确匹配优先”策略
     */
    async function updateCandidates() {
        candidatesContainer.innerHTML = '';
        if (!currentPinyin) return;

        // 使用数组来保证顺序
        let orderedCandidates = [];

        // --- 1. 智能整句预测 (保持不变) ---
        const segments = await segmentPinyin(currentPinyin);
        if (segments.length > 1) {
            const topWords = await Promise.all(segments.map(p => getTopWord(p)));
            const sentence = topWords.filter(word => word).join('');
            if (sentence) {
                orderedCandidates.push(sentence);
            }
        }
        
        // --- 2. 词组和单字匹配 (新逻辑) ---
        const firstChar = currentPinyin[0];
        await loadDictionary(firstChar);
        const pinyinData = loadedDict[firstChar];

        if (pinyinData) {
            // a. 【优先】获取所有“精确匹配”的词
            if (pinyinData[currentPinyin]) {
                orderedCandidates.push(...pinyinData[currentPinyin]);
            }

            // b. 【补充】获取“前缀匹配”的词 (例如输入'da'，匹配'dan', 'dang'等)
            let prefixMatchWords = [];
            for (const pinyin in pinyinData) {
                // 条件是：以此开头，但又不是它本身
                if (pinyin.startsWith(currentPinyin) && pinyin !== currentPinyin) {
                    prefixMatchWords.push(...pinyinData[pinyin]);
                }
            }
            // 对补充的词进行排序和数量限制
            const sortedPrefixWords = [...new Set(prefixMatchWords)]
                .sort((a, b) => a.length - b.length)
                .slice(0, 40); // 限制补充词的数量，避免列表过长

            orderedCandidates.push(...sortedPrefixWords);
        }

        // --- 3. 渲染最终候选列表 ---
        // 使用 Set 去重，同时保留顺序
        const finalCandidates = [...new Set(orderedCandidates)];

        if (finalCandidates.length === 0) {
            // 如果没有任何候选，显示原始英文字符串作为候选
            const fallbackEl = document.createElement('div');
            fallbackEl.classList.add('candidate-item');
            fallbackEl.textContent = currentPinyin;
            fallbackEl.addEventListener('click', () => selectCandidate(currentPinyin));
            candidatesContainer.appendChild(fallbackEl);
        } else {
            // 同样可以加一个总数限制，防止UI爆炸
            const candidatesToDisplay = finalCandidates.slice(0, 100); 
            candidatesToDisplay.forEach(word => {
                const candidateElement = document.createElement('div');
                candidateElement.classList.add('candidate-item');
                candidateElement.textContent = word;
                candidateElement.addEventListener('click', () => selectCandidate(word));
                candidatesContainer.appendChild(candidateElement);
            });
        }
    }

    // --- 其他函数和事件监听 (无变化) ---
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
        if (!firstChar || !/^[a-z]$/.test(firstChar) || (loadedDict[firstChar] && loadedDict[firstChar] !== "loading")) {
            return;
        }
        if (loadedDict[firstChar] === "loading") { // 如果正在加载，等待加载完成
             await new Promise(resolve => {
                const interval = setInterval(() => {
                    if (loadedDict[firstChar] !== "loading") {
                        clearInterval(interval);
                        resolve();
                    }
                }, 50);
            });
            return;
        }
        try {
            loadedDict[firstChar] = "loading"; 
            const response = await fetch(`dict/${firstChar}.json`);
            if (!response.ok) throw new Error(`Dictionary for '${firstChar}' not found`);
            loadedDict[firstChar] = await response.json();
        } catch (error) {
            console.error(error);
            loadedDict[firstChar] = null;
        }
    }
    function selectCandidate(word) {
        outputText.value += word;
        currentPinyin = '';
        pinyinDisplay.textContent = '';
        candidatesContainer.innerHTML = '';
    }
    function handleKeyPress(key) {
        switch (key) {
            case 'backspace':
                currentPinyin = currentPinyin.slice(0, -1);
                break;
            case 'enter':
                if (currentPinyin) {
                    selectCandidate(currentPinyin);
                }
                return;
            case 'space':
                const firstCandidate = candidatesContainer.querySelector('.candidate-item');
                if (firstCandidate) {
                    firstCandidate.click();
                } else {
                    selectCandidate(' ');
                }
                return;
            default:
                if (/^[a-z]$/.test(key) && currentPinyin.length < 20) {
                    currentPinyin += key;
                }
                break;
        }
        pinyinDisplay.textContent = currentPinyin;
        updateCandidates();
    }
    keyboardContainer.addEventListener('click', (event) => {
        const keyElement = event.target.closest('.key');
        if (keyElement) {
            handleKeyPress(keyElement.dataset.key.toLowerCase());
        }
    });
    clearBtn.addEventListener('click', () => { outputText.value = ''; });
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
            alert('复制失败');
        });
    });
    backspaceBtn.addEventListener('click', () => { outputText.value = outputText.value.slice(0, -1); });
    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = body.classList.contains('light-mode') ? 'light' : 'dark';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        applyTheme(newTheme);
        localStorage.setItem('ime-theme', newTheme);
    });

    // --- 初始化 ---
    createKeyboard();
    const savedTheme = localStorage.getItem('ime-theme') || 'dark';
    applyTheme(savedTheme);
    preloadAllDictionaries();
});