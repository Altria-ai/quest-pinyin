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
    const loadingStatus = document.getElementById('loading-status');

    // --- 状态变量等 ---
    let currentPinyin = '';
    let loadedDict = {};
    const sunIcon = '☀️';
    const moonIcon = '🌙';

    /**
     * 【新增】动态更新网站的 Favicon
     * @param {string} emoji - 用作图标的 Emoji 字符
     */
    function updateFavicon(emoji) {
        // 查找现有的 favicon link 标签
        let favicon = document.querySelector('link[rel="icon"]');
        // 如果不存在，就创建一个
        if (!favicon) {
            favicon = document.createElement('link');
            favicon.rel = 'icon';
            document.head.appendChild(favicon);
        }

        // 创建一个包含 Emoji 的 SVG
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
                <text y=".9em" font-size="90" text-anchor="middle" x="50%">${emoji}</text>
            </svg>
        `.trim();

        // 将 SVG 转换为 Data URL 并设置为 favicon 的 href
        favicon.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
    }

    /**
     * 【修改】在应用主题的函数中，同时更新 Favicon
     * @param {string} theme - 'light' 或 'dark'
     */
    function applyTheme(theme) {
        if (theme === 'light') {
            body.classList.add('light-mode');
            themeToggleBtn.textContent = moonIcon;
            updateFavicon(sunIcon); // 【新增】浅色模式用太阳图标
        } else {
            body.classList.remove('light-mode');
            themeToggleBtn.textContent = sunIcon;
            updateFavicon(moonIcon); // 【新增】深色模式用月亮图标
        }
    }

    const keyLayout = [
        ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
        ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
        ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
        ['Backspace', 'Space', 'Enter']
    ];
    
    // ... 其他所有函数 (preloadAllDictionaries, updateCandidates, etc.) 保持不变 ...
    
    async function preloadAllDictionaries() {
        console.log("开始预加载所有字典...");
        const dictPrefixes = 'abcdefghjklmnopqrstwyz'.split(''); // 23个
        const totalDicts = dictPrefixes.length;
        let loadedCount = 0;

        loadingStatus.textContent = `正在加载字典 (0/${totalDicts})...`;

        const promises = dictPrefixes.map(async (char) => {
            try {
                await loadDictionary(char);
            } catch (error) {
            } finally {
                loadedCount++;
                loadingStatus.textContent = `正在加载字典 (${loadedCount}/${totalDicts})...`;
            }
        });
        
        try {
            await Promise.all(promises);
            console.log("所有字典预加载完成！");
            loadingStatus.textContent = "字典加载完成!";
            setTimeout(() => {
                loadingStatus.style.transition = 'opacity 0.5s';
                loadingStatus.style.opacity = '0';
                setTimeout(() => loadingStatus.textContent = '', 500);
            }, 1500);
        } catch (error) {
            console.error("预加载字典时发生严重错误:", error);
            loadingStatus.textContent = "字典加载失败!";
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
    
    async function updateCandidates() {
        candidatesContainer.innerHTML = '';
        if (!currentPinyin) return;
        let orderedCandidates = [];
        const segments = await segmentPinyin(currentPinyin);
        if (segments.length > 1) {
            const topWords = await Promise.all(segments.map(p => getTopWord(p)));
            const sentence = topWords.filter(word => word).join('');
            if (sentence) {
                orderedCandidates.push(sentence);
            }
        }
        const firstChar = currentPinyin[0];
        await loadDictionary(firstChar);
        const pinyinData = loadedDict[firstChar];
        if (pinyinData) {
            if (pinyinData[currentPinyin]) {
                orderedCandidates.push(...pinyinData[currentPinyin]);
            }
            let prefixMatchWords = [];
            for (const pinyin in pinyinData) {
                if (pinyin.startsWith(currentPinyin) && pinyin !== currentPinyin) {
                    prefixMatchWords.push(...pinyinData[pinyin]);
                }
            }
            const sortedPrefixWords = [...new Set(prefixMatchWords)]
                .sort((a, b) => a.length - b.length)
                .slice(0, 40);
            orderedCandidates.push(...sortedPrefixWords);
        }
        const finalCandidates = [...new Set(orderedCandidates)];
        if (finalCandidates.length === 0) {
            const fallbackEl = document.createElement('div');
            fallbackEl.classList.add('candidate-item');
            fallbackEl.textContent = currentPinyin;
            fallbackEl.addEventListener('click', () => selectCandidate(currentPinyin));
            candidatesContainer.appendChild(fallbackEl);
        } else {
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
        if (loadedDict[firstChar] === "loading") {
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
            if (!response.ok) {
                throw new Error(`字典 '${firstChar}.json' 加载失败, 状态: ${response.status}`);
            }
            loadedDict[firstChar] = await response.json();
        } catch (error) {
            console.error(error);
            loadedDict[firstChar] = null;
            throw error;
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