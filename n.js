require('dotenv').config();
const axios = require('axios');

// URL endpoint
const loginUrl = 'https://api.hamsterkombat.io/auth/auth-by-telegram-webapp';
const tapUrl = 'https://api.hamsterkombat.io/clicker/tap';
const listTasksUrl = 'https://api.hamsterkombat.io/clicker/list-tasks';
const checkTaskUrl = 'https://api.hamsterkombat.io/clicker/check-task';
const buyBoostUrl = 'https://api.hamsterkombat.io/clicker/buy-boost';
const boostsUrl = 'https://api.hamsterkombat.io/clicker/boosts-for-buy';

// Array data login untuk multi akun dari file .env
const loginDataArray = [
    { initDataRaw: process.env.LOGIN_DATA_1 },
    { initDataRaw: process.env.LOGIN_DATA_2 },
    { initDataRaw: process.env.LOGIN_DATA_3 },
    { initDataRaw: process.env.LOGIN_DATA_4 },
    { initDataRaw: process.env.LOGIN_DATA_5 },
    { initDataRaw: process.env.LOGIN_DATA_6 }
    // Tambahkan data login lainnya sesuai jumlah akun di .env
];
// Variabel untuk melacak status cooldown
const boostCooldowns = {};

// Fungsi untuk login dan mendapatkan authToken
async function login(loginData) {
    try {
        const response = await axios.post(loginUrl, loginData);
        if (response.data && response.data.authToken) {
            console.log('Login berhasil:', response.data.authToken);
            return response.data.authToken;
        } else {
            console.error('Login gagal:', response.data);
            return null;
        }
    } catch (error) {
        console.error('Error saat login:', error);
        return null;
    }
}

// Fungsi untuk melakukan tapping
async function tap(authToken) {
    try {
        const timestamp = Math.floor(Date.now() / 1000);
        const response = await axios.post(tapUrl, {
            count: 1,
            availableTaps: 10,
            timestamp: timestamp
        }, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        const { id, balanceCoins, level } = response.data.clickerUser;
        console.log(`ID: ${id}, Balance Coins: ${balanceCoins}, Level: ${level}`);
    } catch (error) {
        console.error('Error saat tapping:', error.response ? error.response.data : error.message);
    }
}

// Fungsi untuk mendapatkan daftar task
async function getTasks(authToken) {
    try {
        console.log('Mendapatkan daftar task dengan authToken:', authToken);
        const response = await axios.post(listTasksUrl, {}, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('Daftar task:', response.data);
        return response.data.tasks;
    } catch (error) {
        console.error('Error saat mendapatkan daftar task:', error.response ? error.response.data : error.message);
        console.log('Response error details:', error.response);
        return [];
    }
}

// Fungsi untuk menyelesaikan task
async function completeTask(authToken, taskId) {
    try {
        console.log('Menyelesaikan task:', taskId);
        const response = await axios.post(checkTaskUrl, { taskId: taskId }, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        if (response.data.task && response.data.task.isCompleted) {
            console.log(`Task ${taskId} berhasil diselesaikan. Reward: ${response.data.task.rewardCoins} coins.`);
        } else {
            console.log(`Task ${taskId} belum selesai.`);
        }
    } catch (error) {
        console.error('Error saat menyelesaikan task:', error.response ? error.response.data : error.message);
    }
}

// Fungsi untuk menyelesaikan task streak_days jika sudah ganti hari
async function completeStreakDaysTask(authToken) {
    let lastDateChecked = new Date().getDate();

    setInterval(async () => {
        const currentDate = new Date().getDate();
        if (currentDate !== lastDateChecked) {
            try {
                const tasks = await getTasks(authToken);
                const streakDaysTask = tasks.find(task => task.name === 'streak_days');
                if (streakDaysTask && !streakDaysTask.isCompleted) {
                    await completeTask(authToken, streakDaysTask.id);
                }
            } catch (error) {
                console.error('Error saat menyelesaikan task streak_days:', error.response ? error.response.data : error.message);
            }
            lastDateChecked = currentDate;
        }
    }, 5000);
}

// Fungsi untuk membeli boost
async function buyBoost(authToken, boostId) {
    try {
        const response = await axios.post(buyBoostUrl, {
            boostId: boostId,
            timestamp: Math.floor(Date.now() / 1000)
        }, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`Boost ${boostId} berhasil dibeli:`, response.data);
        // Hapus cooldown setelah berhasil membeli
        delete boostCooldowns[boostId];
    } catch (error) {
        if (error.response && error.response.data && error.response.data.error_code === 'BOOST_COOLDOWN') {
            const remainingCooldown = error.response.data.error_message.match(/(\d+) seconds/);
            if (remainingCooldown && remainingCooldown[1]) {
                const cooldownSeconds = parseInt(remainingCooldown[1], 10) * 1000;
                console.log(`Boost ${boostId} sedang cooldown, menunggu ${remainingCooldown[1]} detik.`);
                // Set cooldown untuk boost
                boostCooldowns[boostId] = Date.now() + cooldownSeconds;
            }
        } else {
            console.error('Error saat membeli boost:', error.response ? error.response.data : error.message);
        }
    }
}

// Fungsi untuk mendapatkan informasi boost dan cooldown
async function getBoostsInfo(authToken) {
    try {
        const response = await axios.post(boostsUrl, {}, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('Respons boosts:', response.data); // Tambahkan log respons untuk debugging
        return response.data.boostsForBuy;
    } catch (error) {
        console.error('Error saat mendapatkan informasi boost:', error.response ? error.response.data : error.message);
        return null;
    }
}

// Fungsi untuk mengklaim "BoostFullAvailableTaps" setiap kali cooldown berakhir
async function claimBoostFullAvailableTaps(authToken) {
    setInterval(async () => {
        if (boostCooldowns["BoostFullAvailableTaps"] && boostCooldowns["BoostFullAvailableTaps"] > Date.now()) {
            console.log(`BoostFullAvailableTaps sedang cooldown, menunggu hingga ${new Date(boostCooldowns["BoostFullAvailableTaps"])}`);
            return;
        }

        try {
            await buyBoost(authToken, "BoostFullAvailableTaps");
        } catch (error) {
            console.error('Error saat mengklaim BoostFullAvailableTaps:', error.response ? error.response.data : error.message);
        }
    }, 5000); // Cek setiap 5 detik
}

// Fungsi untuk membeli boost "BoostMaxTaps" setiap 5 detik jika level <= 5
async function buyBoostEveryFiveSeconds(authToken) {
    setInterval(async () => {
        if (boostCooldowns["BoostMaxTaps"] && boostCooldowns["BoostMaxTaps"] > Date.now()) {
            console.log(`BoostMaxTaps sedang cooldown, menunggu hingga ${new Date(boostCooldowns["BoostMaxTaps"])}`);
            return;
        }

        try {
            const boostsInfo = await getBoostsInfo(authToken);
            if (!boostsInfo) {
                console.error('Tidak dapat mendapatkan informasi boost.');
                return;
            }
            const maxTapsBoost = boostsInfo.find(boost => boost.id === 'BoostMaxTaps');

            if (maxTapsBoost && maxTapsBoost.level < 5) {
                await buyBoost(authToken, "BoostMaxTaps");
            } else {
                console.log(`BoostMaxTaps level saat ini: ${maxTapsBoost ? maxTapsBoost.level : 'undefined'}, tidak membeli karena level >= 5 atau boost tidak ditemukan`);
            }
        } catch (error) {
            console.error('Error saat membeli BoostMaxTaps:', error.response ? error.response.data : error.message);
        }
    }, 5000); // 5 detik dalam milidetik
}

// Fungsi untuk menjalankan operasi pada satu akun
async function runSingleAccountBot(loginData) {
    const authToken = await login(loginData);
    if (authToken) {
        // Mendapatkan daftar task dan menyelesaikannya
        const tasks = await getTasks(authToken);
        for (const task of tasks) {
            if (!task.isCompleted && task.name !== 'streak_days') {
                await completeTask(authToken, task.id);
            }
        }

        // Menyelesaikan task streak_days jika sudah ganti hari
        completeStreakDaysTask(authToken);

        // Melakukan tapping setiap 0.5 detik
        setInterval(() => {
            tap(authToken);
        }, 500);

        // Membeli boost "BoostMaxTaps" setiap 5 detik jika level <= 5
        buyBoostEveryFiveSeconds(authToken);

        // Mengklaim BoostFullAvailableTaps setiap kali cooldown berakhir
        claimBoostFullAvailableTaps(authToken);
    }
}

// Fungsi utama untuk menjalankan bot dengan multi akun
async function runMultiAccountBot() {
    for (const loginData of loginDataArray) {
        runSingleAccountBot(loginData);
    }
}

runMultiAccountBot();