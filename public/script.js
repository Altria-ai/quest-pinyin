document.addEventListener('DOMContentLoaded', () => {
    // --- 元素获取 ---
    const keyboardContainer = document.getElementById('keyboard-container');
    const pinyinDisplay = document.getElementById('pinyin-display');
    const candidatesContainer = document.getElementById('candidates-container');
    const outputText = document.getElementById('output-text');
    const clearBtn = document.getElementById('clear-btn');
    const copyBtn = document.getElementById('copy-btn');
    const backspaceBtn = document.getElementById('backspace-btn');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const body = document.body;

    // --- 状态变量 ---
    let currentPinyin = '';
    let loadedDict = {};

    // 【修改 1】使用 Emoji 替换 SVG
    const sunIcon = '☀️';
    const moonIcon = '🌙';

    function applyTheme(theme) {
        if (theme === 'light') {
            body.classList.add('light-mode');
            themeToggleBtn.textContent = moonIcon; // 使用 textContent 设置 Emoji
        } else {
            body.classList.remove('light-mode');
            themeToggleBtn.textContent = sunIcon; // 使用 textContent 设置 Emoji
        }
    }
    
    // --- 键盘布局 ---
    const keyLayout = [
        ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
        ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
        ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
        ['Backspace', 'Space', 'Enter']
    ];

    /**
     * 【修改 2】新增：在后台预加载所有字典文件
     */
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

    // --- 其他核心功能函数 (无变化，保持原样) ---
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
    async function updateCandidates() {
        candidatesContainer.innerHTML = '';
        if (!currentPinyin) return;
        let finalCandidates = new Set();
        const segments = await segmentPinyin(currentPinyin);
        if (segments.length > 1) {
            const topWords = await Promise.all(segments.map(p => getTopWord(p)));
            const sentence = topWords.filter(word => word).join('');
            if (sentence) {
                finalCandidates.add(sentence);
            }
        }
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
            const sortedPrefixWords = [...new Set(prefixWords)]
                .sort((a, b) => a.length - b.length)
                .slice(0, 20);
            sortedPrefixWords.forEach(word => finalCandidates.add(word));
        }
        if (finalCandidates.size === 0 && currentPinyin) {
            const fallbackEl = document.createElement('div');
            fallbackEl.classList.add('candidate-item');
            fallbackEl.textContent = currentPinyin;
            fallbackEl.addEventListener('click', () => selectCandidate(currentPinyin));
            candidatesContainer.appendChild(fallbackEl);
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
    // `loadDictionary` 函数现在被预加载和实时输入共同调用
    async function loadDictionary(firstChar) {
        if (!firstChar || !/^[a-z]$/.test(firstChar) || loadedDict[firstChar]) {
            return;
        }
        try {
            // 标记为正在加载，防止重复请求
            loadedDict[firstChar] = "loading"; 
            const response = await fetch(`dict/${firstChar}.json`);
            if (!response.ok) throw new Error(`Dictionary for '${firstChar}' not found`);
            loadedDict[firstChar] = await response.json();
        } catch (error) {
            console.error(error);
            loadedDict[firstChar] = null; // 标记为加载失败
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
            case 'Backspace':
                currentPinyin = currentPinyin.slice(0, -1);
                break;
            case 'Enter':
                if (currentPinyin) {
                    selectCandidate(currentPinyin);
                }
                return;
            case 'Space':
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

    // --- 事件监听 (无变化) ---
    keyboardContainer.addEventListener('click', (event) => {
        const keyElement = event.target.closest('.key');
        if (keyElement) {
            handleKeyPress(keyElement.dataset.key);
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

    // 【修改 2】在所有初始化完成后，开始在后台预加载字典
    preloadAllDictionaries();
});