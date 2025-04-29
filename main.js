const colors = require('colors');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const fs = require('fs');
const readline = require('readline');
const { DateTime } = require('luxon');

console.log('3DOS BOT'.blue);

const generateRandomUserAgent = () => {
    const os = [
        'Windows NT 10.0; Win64; x64',
        'Windows NT 6.1; Win64; x64',
        'Windows NT 11.0; Win64; x64',
        'Macintosh; Intel Mac OS X 10_15_7',
        'Macintosh; Intel Mac OS X 11_2_3',
        'Macintosh; Intel Mac OS X 12_0_1',
        'X11; Linux x86_64',
        'X11; Ubuntu; Linux x86_64',
        'iPhone; CPU iPhone OS 16_0 like Mac OS X',
        'iPad; CPU OS 15_0 like Mac OS X',
        'Android 12; Mobile',
        'Android 13; SM-G960F Build/R16NW',
    ];

    const browsers = [
        { name: 'Chrome', minVersion: 90, maxVersion: 133, suffix: 'Safari/537.36' },
        { name: 'Firefox', minVersion: 80, maxVersion: 128, suffix: '' },
        { name: 'Safari', minVersion: 14, maxVersion: 17, suffix: 'Version/#VERSION# Safari/605.1.15' },
        { name: 'Edge', minVersion: 90, maxVersion: 133, suffix: 'Safari/537.36' },
        { name: 'Opera', minVersion: 70, maxVersion: 100, suffix: 'Chrome/#VERSION# Safari/537.36' },
    ];

    const system = os[Math.floor(Math.random() * os.length)];
    const browser = browsers[Math.floor(Math.random() * browsers.length)];

    const version = Math.floor(Math.random() * (browser.maxVersion - browser.minVersion + 1)) + browser.minVersion;
    const versionString = `${version}.0.0${Math.floor(Math.random() * 10)}`;

    const engines = [
        'AppleWebKit/537.36 (KHTML, like Gecko)',
        'Gecko/20100101',
        'AppleWebKit/605.1.15 (KHTML, like Gecko)',
    ];
    const engine = engines[Math.floor(Math.random() * engines.length)];

    let ua = `Mozilla/5.0 (${system}) ${engine}`;
    
    if (browser.name === 'Safari') {
        ua += ` ${browser.suffix.replace('#VERSION#', versionString)}`;
    } else if (browser.name === 'Opera') {
        ua += ` ${browser.name}/${versionString} ${browser.suffix.replace('#VERSION#', versionString)}`;
    } else {
        ua += ` ${browser.name}/${versionString} ${browser.suffix}`;
    }

    const extras = [
        '',
        'OPR/' + Math.floor(Math.random() * 20 + 80) + '.0.0',
        'UCBrowser/' + Math.floor(Math.random() * 10) + '.0.0',
    ];
    const extra = extras[Math.floor(Math.random() * extras.length)];
    if (extra) ua += ` ${extra}`;

    return ua;
};

const generateAndSaveUserAgents = (count) => {
    const userAgents = [];
    for (let i = 0; i < count; i++) {
        userAgents.push(generateRandomUserAgent());
    }
    fs.writeFileSync('agent.txt', userAgents.join('\n'));
    console.log(`✅ Đã tạo và lưu ${count} User-Agents vào agent.txt`.green);
    return userAgents;
};

const loadUserAgents = () => {
    try {
        const data = fs.readFileSync('agent.txt', 'utf8').trim();
        return data ? data.split('\n').map(line => line.trim()).filter(Boolean) : [];
    } catch {
        console.log('ℹ️ Chưa tìm thấy agent.txt, sẽ tạo mới.'.yellow);
        return [];
    }
};

const loadProxies = () => {
    try {
        const data = fs.readFileSync('proxy.txt', 'utf8').trim();
        return data ? data.split('\n').map(line => line.trim()).filter(Boolean) : [];
    } catch {
        return [];
    }
};

const getProxyAgent = (proxy) => {
    if (!proxy) return null;
    if (proxy.startsWith('http://') || proxy.startsWith('https://')) {
        return new HttpsProxyAgent(proxy);
    } else {
        console.log(`❌ Định dạng proxy không hợp lệ: ${proxy}`.red);
        return null;
    }
};

const loadCredentials = () => {
    try {
        const data = fs.readFileSync('data.txt', 'utf8').trim();
        const credentials = data.split('\n').map(line => {
            const [email, password] = line.trim().split('|');
            return { email, password };
        }).filter(cred => cred.email && cred.password);
        console.log(`✅ Đọc được ${credentials.length} tài khoản từ data.txt.`.green);
        return credentials;
    } catch {
        console.log('❌ Lỗi rồi: data.txt không tìm thấy hoặc trống.'.red);
        process.exit(1);
    }
};

const login = async (proxy, email, password, userAgent, retries = 3) => {
    const proxyAgent = getProxyAgent(proxy);
    const url = 'https://api.dashboard.3dos.io/api/auth/login';
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios.post(url, { email, password }, {
                headers: {
                    'User-Agent': userAgent,
                    'Accept': 'application/json, text/plain, */*',
                    'Content-Type': 'application/json',
                    'Origin': 'https://dashboard.3dos.io',
                    'Referer': 'https://dashboard.3dos.io/',
                },
                httpsAgent: proxyAgent,
                timeout: 60000,
            });
            if (response.data.status === 'Success') {
                console.log(`✅ Tài khoản ${email} đã đăng nhập thành công!`.green);
                return response.data.data.access_token;
            } else {
                console.log(`❌ Tài khoản ${email} đăng nhập thất bại: ${JSON.stringify(response.data)}`.red);
                return null;
            }
        } catch (error) {
            const errorMsg = error.response ? 
                `Status ${error.response.status}: ${JSON.stringify(error.response.data)}` : 
                error.message;
            console.log(`❌ Tài khoản ${email} gặp lỗi đăng nhập (Lần ${attempt}/${retries}): ${errorMsg}`.red);
            if (attempt < retries) {
                console.log(`ℹ️ Thử lại sau 5 giây...`.yellow);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
            if (attempt === retries) return null;
        }
    }
};

const sendPing = async (proxy, secret, userAgent) => {
    const proxyAgent = getProxyAgent(proxy);
    const url = `https://api.dashboard.3dos.io/api/profile/api/${secret}`;
    try {
        const response = await axios.post(url, null, {
            headers: {
                'User-Agent': userAgent,
                'Accept': '*/*',
                'Origin': 'chrome-extension://lpindahibbkakkdjifonckbhopdoaooe',
            },
            httpsAgent: proxyAgent,
        });
        if (response.data?.status === 'Success') {
            console.log(`✅ Ping thành công ${secret}: Success`.green);
        } else {
            console.log(`❌ Ping không thành công ${secret}.`.red);
        }
    } catch (error) {
        console.log(`❌ Lỗi ping ${secret}: ${error.message}`.red);
    }
};

const refreshPoints = async (proxy, secret, userAgent) => {
    const proxyAgent = getProxyAgent(proxy);
    const url = `https://api.dashboard.3dos.io/api/refresh-points/${secret}`;
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': userAgent,
                'Accept': '*/*',
                'Origin': 'chrome-extension://lpindahibbkakkdjifonckbhopdoaooe',
            },
            httpsAgent: proxyAgent,
        });
        if (response.data?.data?.total_points !== undefined) {
            const logMessage = `✅ Tổng số điểm cho ${secret}: ${response.data.data.total_points}`;
            console.log(logMessage.green);
            const timestamp = new Date().toISOString();
            fs.appendFileSync('log.txt', `[${timestamp}] ${logMessage}\n`, 'utf8');
        }
    } catch (error) {
    }
};

const claimDailyReward = async (proxy, token, email, userAgent) => {
    const proxyAgent = getProxyAgent(proxy);
    const url = 'https://api.dashboard.3dos.io/api/claim-reward';
    try {
        const response = await axios.post(url, { id: 'daily-reward-api' }, {
            headers: {
                'User-Agent': userAgent,
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                'Origin': 'https://dashboard.3dos.io',
                'Referer': 'https://dashboard.3dos.io/',
                'Authorization': `Bearer ${token}`,
            },
            httpsAgent: proxyAgent,
        });
        if (response.data.status === 'Success') {
            console.log(`✅ Nhận phần thưởng hàng ngày thành công | ${response.data.data.points} points`.green);
            return true;
        } else {
            console.log(`❌ Không thể nhận phần thưởng hàng ngày cho tài khoản ${email}`.red);
            return false;
        }
    } catch (error) {
        console.log(`❌ Lỗi nhận phần thưởng hàng ngày tài khoản ${email}: ${error.message}`.red);
        return false;
    }
};

const getProfile = async (proxy, token, email, userAgent, retries = 100) => {
    const proxyAgent = getProxyAgent(proxy);
    const url = 'https://api.dashboard.3dos.io/api/profile/me';
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios.post(url, {}, {
                headers: {
                    'User-Agent': userAgent,
                    'Accept': 'application/json, text/plain, */*',
                    'Content-Type': 'application/json',
                    'Origin': 'https://dashboard.3dos.io',
                    'Referer': 'https://dashboard.3dos.io/',
                    'Authorization': `Bearer ${token}`,
                },
                httpsAgent: proxyAgent,
            });
            if (response.data.status === 'Success') {
                const { todays_earning, loyalty_points, api_secret, daily_reward_claim } = response.data.data;
                console.log(`✅ Tài khoản ${email} - Today's Earning: ${todays_earning}, Loyalty Points: ${loyalty_points}`.green);

                const now = DateTime.now();
                if (!daily_reward_claim) {
                    await claimDailyReward(proxy, token, email, userAgent);
                } else {
                    const lastClaim = DateTime.fromISO(daily_reward_claim);
                    const diff = now.diff(lastClaim, 'hours').hours;
                    if (diff >= 24.0167) {
                        await claimDailyReward(proxy, token, email, userAgent);
                    } else {
                        console.log(`ℹ️ Bạn đã điểm danh hàng ngày lúc ${lastClaim.setZone(DateTime.local().zoneName).toLocaleString(DateTime.DATETIME_FULL)}`.yellow);
                    }
                }

                return { api_secret, success: true };
            } else {
                console.log(`❌ Không thể đọc profile tài khoản ${email}`.red);
                return { api_secret: null, success: false };
            }
        } catch (error) {
            console.log(`❌ Lỗi đọc profile tài khoản ${email} (Lần thử ${attempt}/${retries}): ${error.message}`.red);
            if (attempt < retries) await new Promise(resolve => setTimeout(resolve, 3000));
            if (attempt === retries) return { api_secret: null, success: false };
        }
    }
};

const generateApiKey = async (proxy, token, email, userAgent, retries = 100) => {
    const proxyAgent = getProxyAgent(proxy);
    const url = 'https://api.dashboard.3dos.io/api/profile/generate-api-key';
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios.post(url, {}, {
                headers: {
                    'User-Agent': userAgent,
                    'Accept': 'application/json, text/plain, */*',
                    'Content-Type': 'application/json',
                    'Origin': 'https://dashboard.3dos.io',
                    'Referer': 'https://dashboard.3dos.io/',
                    'Authorization': `Bearer ${token}`,
                },
                httpsAgent: proxyAgent,
            });
            if (response.data.status === 'Success') {
                const api_secret = response.data.data.api_secret;
                console.log(`✅ Đã tạo api key cho tài khoản ${email}: ${api_secret}`.green);
                return api_secret;
            } else {
                console.log(`❌ Không tạo được api key cho tài khoản ${email}`.red);
                return null;
            }
        } catch (error) {
            console.log(`❌ Lỗi tạo api key tài khoản ${email} (Lần thử ${attempt}/${retries}): ${error.message}`.red);
            if (attempt < retries) await new Promise(resolve => setTimeout(resolve, 3000));
            if (attempt === retries) return null;
        }
    }
};

const askProxyUsage = () => {
    return new Promise((resolve) => {
        readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        }).question('Bạn có sử dụng proxy không? (y/n): ', (answer) => {
            resolve(answer.trim().toLowerCase() === 'y');
        });
    });
};

const main = async () => {
    const useProxy = await askProxyUsage();
    const proxies = useProxy ? loadProxies() : [];
    const credentials = loadCredentials();

    let userAgents = loadUserAgents();
    if (userAgents.length < credentials.length) {
        userAgents = generateAndSaveUserAgents(credentials.length);
    }

    if (useProxy) {
        if (proxies.length < credentials.length) {
            console.log(`❌ Số lượng proxy (${proxies.length}) không đủ cho ${credentials.length} tài khoản. Cần ít nhất ${credentials.length} proxy.` .red);
            process.exit(1);
        }
    }

    const apiSecrets = [];
    const maxAccounts = useProxy ? credentials.length : 1;

    for (let i = 0; i < maxAccounts; i++) {
        const { email, password } = credentials[i];
        const proxy = useProxy ? proxies[i] : null;
        const userAgent = userAgents[i];

        console.log(`ℹ️ Sử dụng User-Agent cho ${email}: ${userAgent}`.yellow);
        if (useProxy) console.log(`ℹ️ Proxy cho ${email}: ${proxies[i]}`.yellow);

        const token = await login(proxy, email, password, userAgent);
        if (!token) continue;

        let { api_secret, success } = await getProfile(proxy, token, email, userAgent);
        if (!success) continue;

        if (!api_secret) {
            api_secret = await generateApiKey(proxy, token, email, userAgent);
        }

        if (api_secret) {
            apiSecrets.push(api_secret);
        }
    }

    if (apiSecrets.length === 0) {
        console.log('❌ Không tìm thấy api nào...'.red);
        process.exit(1);
    }

    let refreshIndex = 0;
    setInterval(async () => {
        const proxy = useProxy ? proxies[refreshIndex % apiSecrets.length] : null;
        for (let i = 0; i < apiSecrets.length; i++) {
            await refreshPoints(proxy, apiSecrets[i], userAgents[i]);
        }
        refreshIndex++;
    }, 360000);

    let pingIndex = 0;
    console.log('🔄 Bắt đầu ping mỗi 3 giây.'.blue);
    setInterval(async () => {
        const proxy = useProxy ? proxies[pingIndex % apiSecrets.length] : null;
        const secret = apiSecrets[pingIndex % apiSecrets.length];
        const userAgent = userAgents[pingIndex % apiSecrets.length];
        await sendPing(proxy, secret, userAgent);
        pingIndex++;
    }, 3000);
};

main();