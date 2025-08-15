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
    let loadedDict = null;
    let isDictLoading = false;
    const sunIcon = '☀️';
    const moonIcon = '🌙';
    const keyLayout = [
        ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
        ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
        ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
        ['Backspace', 'Space', 'Enter']
    ];

    // --- 核心功能函数 ---

    function updateFavicon(emoji) {
        let favicon = document.querySelector('link[rel="icon"]');
        if (!favicon) {
            favicon = document.createElement('link');
            favicon.rel = 'icon';
            document.head.appendChild(favicon);
        }
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90" text-anchor="middle" x="50%">${emoji}</text></svg>`.trim();
        favicon.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
    }
    
    function applyTheme(theme) {
        if (theme === 'light') {
            body.classList.add('light-mode');
            themeToggleBtn.textContent = moonIcon;
            updateFavicon(sunIcon);
        } else {
            body.classList.remove('light-mode');
            themeToggleBtn.textContent = sunIcon;
            updateFavicon(moonIcon);
        }
    }

    async function loadFullDictionary() {
        if (loadedDict || isDictLoading) return;
        
        isDictLoading = true;
        loadingStatus.textContent = "准备加载字典...";
        console.log("开始加载主字典...");

        try {
            const response = await fetch('dict/dict.json');

            if (!response.ok) {
                throw new Error(`主字典加载失败, 状态: ${response.status}`);
            }

            const totalLength = +response.headers.get('Content-Length');
            
            // 【核心修改点】
            // 如果无法获取文件总大小（例如因为服务器启用了动态压缩），
            // 则提供一个回退提示，并直接加载，不再显示百分比进度。
            if (!totalLength) {
                //console.warn("无法获取字典文件总大小（可能由于动态压缩），无法显示进度。");
                loadingStatus.textContent = "正在加载字典 (请稍候)...";
                
                loadedDict = await response.json(); // 直接等待JSON解析完成
                
                console.log("主字典加载完成！");
                loadingStatus.textContent = "字典加载完成!";
                return; // 提前结束函数，不执行下面的流式读取逻辑
            }

            // --- 只有在获取到 Content-Length 时，才会执行下面的流式读取逻辑 ---
            const reader = response.body.getReader();
            let receivedLength = 0;
            const chunks = [];

            while(true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                receivedLength += value.length;
                const progress = Math.floor((receivedLength / totalLength) * 100);
                loadingStatus.textContent = `正在加载字典 (${progress}%)...`;
            }

            loadingStatus.textContent = "正在解析数据...";
            const chunksAll = new Uint8Array(receivedLength);
            let position = 0;
            for(let chunk of chunks) {
                chunksAll.set(chunk, position);
                position += chunk.length;
            }
            const resultText = new TextDecoder("utf-8").decode(chunksAll);
            loadedDict = JSON.parse(resultText);
            console.log("主字典加载完成！");
            loadingStatus.textContent = "字典加载完成!";

        } catch (error) {
            console.error(error);
            loadingStatus.textContent = "字典加载失败!";
        } finally {
            isDictLoading = false;
            setTimeout(() => {
                if(loadingStatus.textContent === "字典加载完成!" || loadingStatus.textContent === "字典加载失败!") {
                    loadingStatus.style.transition = 'opacity 0.5s';
                    loadingStatus.style.opacity = '0';
                    setTimeout(() => loadingStatus.textContent = '', 500);
                }
            }, 1500);
        }
    }
    
    async function loadDictionary() {
        if (!loadedDict) {
            await loadFullDictionary();
        }
    }

    async function isPinyinValid(pinyin) {
        if (!pinyin) return false;
        await loadDictionary();
        const firstChar = pinyin[0];
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
        await loadDictionary();
        const firstChar = pinyin[0];
        const pinyinData = loadedDict[firstChar];
        if (pinyinData && pinyinData[pinyin] && pinyinData[pinyin][0]) {
            return pinyinData[pinyin][0];
        }
        return null;
    }
    
    async function updateCandidates() {
        candidatesContainer.innerHTML = '';
        if (!currentPinyin) return;

        await loadDictionary();
        if (!loadedDict) return; // 如果字典加载失败，则不继续

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
                } else if (currentPinyin) {
                     selectCandidate(currentPinyin);
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

    // --- 事件监听 ---
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
    loadFullDictionary(); // 页面加载后立即开始异步加载主字典
});