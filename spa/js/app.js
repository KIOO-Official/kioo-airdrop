const info = console.info;
const danger = console.error;
const debug = console.debug;
const warn = console.warn;

const AvaxRpcUrl = 'https://api.avax.network/ext/bc/C/rpc';
const AvaxChainIdHex = ethers.toBeHex(43114);

const AirdropContractAddress = ethers.getAddress('0x9b7646496DF31851a1F3ee72D6Eaf95E3d5352BC');
const KiooAddress = ethers.getAddress('0x45cdaf3fd17bd31d9830fa977159162dd2431683');

const ABI_ERC20 = [
    'function allowance(address,address) view returns (uint256)',
    'function approve(address,uint256) returns (bool)',
    'function balanceOf(address) view returns (uint256)',
];
const _userStateZero = () => {
    return {
        isConnected: false,
        signer: null,
        avaxBalance: 0.0,
        kiooBalance: 0.0,
        isEligible: false, // TODO(c8k): create a function to check eligibility
        rewardClaimed: false,
    };
};
const _contractStateUpdate = async () => {
    const provider = new ethers.JsonRpcProvider(AvaxRpcUrl);
    const ka = new KiooAirdrop(AirdropContractAddress, provider);
    const b = await ka.balance();
    await UpdateKiooPriceUsd();
    return {
        live: await ka.airdropLive(),
        balance: b,
        balanceUsd: ethers.formatEther(b) * KiooInUsd.usdPrice,
        airdropAmount: await ka.dropAmount()
    };
};
const KiooInUsd = {
    usdPrice: 0.0,
    lastTime: 0,
    RATE_LIMIT_MS: 2 * 60 * 1000
};
let UserState = _userStateZero();
let ContractState = { // await not permited outside async function
    live: false,
    balance: 0n,
    balanceUsd: 0,
    airdropAmount: 0n
};
let web3Wallet = null;
let alreadyInitWeb3Events = false;
let web3MobileHandled = false;

$(document).ready(async () => {
    web3Wallet = window.ethereum || window.avalanche;
    if (web3Wallet === null || web3Wallet === undefined) {
        window.addEventListener(
            'ethereum#initialized',
            HandleEthereum,
            { once: true }
        );
        setTimeout(HandleEthereum, 5 * 1000);
        window.removeEventListener('ethereum#initialized', HandleEthereum);
        if (web3Wallet === null || web3Wallet === undefined) {
            return _msg('Wallet Error', 'Please install MetaMask or a Web3 EVM compatible wallet!');
        }
    }

    await InitForm();
    UserState.isConnected = (/true/i).test(GetItem('isConnected'));
    if (UserState.isConnected === true) {
        let elt = $('#button-connect');
        if (elt.is(':visible')) { elt.attr('aria-busy', true); }
        try {
            await ConnectHandler();
        } finally {
            if (elt.is(':visible')) { elt.removeAttr('aria-busy'); }
        }
    }
});

const InitForm = async () => {
    await _updateOnchainState(null);

    // Switch Network group
    $('#button-switch-network').on('click', async (e) => {
        e.preventDefault();
        let elt = $(e.target);
        elt.attr('aria-busy', true);
        try {
            await SwitchNetworkHandler();
        } finally {
            elt.removeAttr('aria-busy');
        }
    });

    // Connect group
    $('#button-connect').on('click', async (e) => {
        e.preventDefault();
        let elt = $(e.target);
        elt.attr('aria-busy', true);
        try {
            await ConnectHandler();
        } finally {
            elt.removeAttr('aria-busy');
        }
    });

    // Disconnect group
    $('#disconnect').on('click', async (e) => {
        e.preventDefault();
        let elt = $(e.target);
        elt.attr('aria-busy', true);
        try {
            await DisconnectHandler();
        } finally {
            elt.removeAttr('aria-busy');
        }
        window.location.reload();
    });

    // Global stats
    $('#stats-contract-balance').text(`${Number.parseFloat(ethers.formatEther(ContractState.balance)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $KIOO`);
    $('#stats-contract-tvl').text(`$${ContractState.balanceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`);

    // Claim button
    $('#claim').on('click', async (e) => {
        e.preventDefault();
        let elt = $(e.target);
        elt.attr('aria-busy', true);
        try {
            await ClaimHandler();
        } finally {
            elt.removeAttr('aria-busy');
        }
    });
};

const UpdateUI = async () => {
    const provider = new ethers.BrowserProvider(web3Wallet, 'any');
    const network = await provider.getNetwork();
    if (network === null || ethers.toBigInt(AvaxChainIdHex) != network.chainId) {
        $('#button-switch-network').parent().show();
        $('#button-connect').parent().hide();
        $('#disconnect').parent().hide();
        return;
    }

    await _updateOnchainState(provider);
    if (UserState.isConnected) {
        SetItem('isConnected', UserState.isConnected);
        $('#button-connect').parent().hide();
        $('#disconnect').parent().parent().parent().show();
    }

    // Global Stats Updates
    $('#stats-contract-balance').text(`${Number.parseFloat(ethers.formatEther(ContractState.balance)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $KIOO`);
    $('#stats-contract-tvl').text(`$${ContractState.balanceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`);

    // Gloabl Updates
    $('#avax-balance').text(`${Number.parseFloat(UserState.avaxBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $AVAX`);
    $('#kioo-balance').text(`${Number.parseFloat(UserState.kiooBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $KIOO`);
    $('#user-address').text(`${UserState.signer.address.substr(0, 5)}...${UserState.signer.address.substr(-3)}`);

    // User Stats Updates
    $('#stats-wallet-balance').text(`${Number.parseFloat(UserState.kiooBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $KIOO`);
    $('#airdrop-amount').html(`${Number.parseFloat(ethers.formatEther(ContractState.airdropAmount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $KIOO`);

    // Checks
    if (ContractState.live === false) {
        danger('KIOO Airdrop contract is not live');
        _msg('KIOO Airdrop Not Live', "<ul><li>KIOO AIRDROP IS NOT LIVE RIGHT NOW</li><li>Please contact the dev team</li></ul>");
        return;
    }

    if (UserState.rewardClaimed) {
        $('#reward-claimed').show('fast');
    } else {
        $('#reward-claimed').hide('fast');

        // Eligibility check wallet
        const eligibilityList = $('#reward-eligibility');
        eligibilityList.html('<li><h3>Requirements</h3></li>');
        eligibilityList.append(`<li>${!UserState.rewardClaimed ? '✅' : '❌'} Reward not yet claimed</li>`);
        eligibilityList.append(`<li>${UserState.kiooBalance == 0.0 ? '✅' : '❌'} No $KIOO in the wallet${UserState.kiooBalance > 0.0 ? ' (send your $KIOO to another wallet)' : ''}</li>`);

        if (UserIsEligible()) {
            $('button#claim').removeAttr('disabled');
        }
    }
};

const _updateOnchainState = async (provider) => {
    if (provider === null) {
        UserState = _userStateZero();
        ContractState = await _contractStateUpdate();
        return;
    }

    const signer = await provider.getSigner();
    UserState.isConnected = signer !== null;
    UserState.signer = signer;
    const signerAddress = await signer.getAddress();
    UserState.avaxBalance = ethers.formatEther(await provider.getBalance(signerAddress, 'latest'));
    const KiooToken = new ethers.Contract(KiooAddress, ABI_ERC20, signer);
    UserState.kiooBalance = ethers.formatEther(await KiooToken.balanceOf(signerAddress));

    const kiooAirdrop = new KiooAirdrop(AirdropContractAddress, signer);

    UserState.rewardClaimed = await kiooAirdrop.claimed(signerAddress);

    ContractState.live = await kiooAirdrop.airdropLive();
    ContractState.balance = await kiooAirdrop.balance();
    await UpdateKiooPriceUsd();
    ContractState.balanceUsd = ethers.formatEther(ContractState.balance) * KiooInUsd.usdPrice;

    debug('UserState: ', UserState);
    debug('ContractState: ', ContractState);
    debug('UpdateKiooPriceUsd: ', KiooInUsd);
};

/* Handlers */

const ConnectHandler = async (e) => {
    if (e) { e.preventDefault(); }
    const provider = new ethers.BrowserProvider(web3Wallet, 'any');
    try {
        // Ask the wallet to be unlocked
        await provider.send('eth_requestAccounts');
    } catch (error) {
        danger(`${error.code}: ${error.message}`);
        _msg('Wallet Error', `<ul><li>Check your wallet notification and connect to web3!</li><li class="small">${error.code}: ${error.message}</li></ul>`);
        return;
    }

    await UpdateUI();

    if (!alreadyInitWeb3Events) {
        try {
            web3Wallet.on('chainChanged', (_chainId) => {
                window.location.reload();
            });
            web3Wallet.on('accountsChanged', (_accounts) => {
                window.location.reload();
            });
            web3Wallet.on('connect', (_connectInfo) => {
                window.location.reload();
            });
            web3Wallet.on('disconnect', async (_error) => {
                await DisconnectHandler();
                window.location.reload();
            });
            web3Wallet.on('message', (message) => {
                debug('[%s] %s', web3Wallet.name || 'Unknown Web3 Wallet', message);
            });
            alreadyInitWeb3Events = true;
        } catch (error) {
            danger('wallet event exception: ', error);
        }
    }
    // debug('Connect:UserSate: ', UserState);
    // debug('Connect:ContractState: ', ContractState);
};

const SwitchNetworkHandler = async (e) => {
    if (e) { e.preventDefault(); }
    const provider = new ethers.BrowserProvider(web3Wallet, 'any');
    try {
        await provider.send("wallet_switchEthereumChain", [{ chainId: AvaxChainIdHex }]);
    } catch (error) {
        if (error.code === 'ACTION_REJECTED') {
            warn("the user doesn't want to change the network!");
        } else if (error.code === 'UNKNOWN_ERROR') {
            warn("this network is not in the user's wallet");
            await provider.send('wallet_addEthereumChain', [
                {
                    chainId: AvaxChainIdHex,
                    chainName: 'Avalanche Mainnet C-Chain',
                    nativeCurrency: {
                        name: 'Avalanche',
                        symbol: 'AVAX',
                        decimals: 18,
                    },
                    rpcUrls: [AvaxRpcUrl],
                    blockExplorerUrls: ['https://snowtrace.io/'],
                }
            ]);

        } else {
            danger(`${error.code}: ${error.message}`);
        }
    }
};

const DisconnectHandler = async (e) => {
    if (e) { e.preventDefault(); }
    UserState = _userStateZero();
    ContractState = await _contractStateUpdate();

    $('#button-connect').parent().show();
    $('#disconnect').parent().hide();

    if (web3Wallet !== null) {
        web3Wallet.removeAllListeners();
    }

    SetItem('isConnected', false);
    // debug('Disconnect:UserSate: ', UserState);
    // debug('Disconnect:ContractState: ', ContractState);
};

const ClaimHandler = async () => {
    if (UserState.signer === null) {
        return _msg('Wallet Error', 'Try to connect your wallet');
    }

    const kiooAirdrop = new KiooAirdrop(AirdropContractAddress, UserState.signer);
    let tx = null;
    try {
        tx = await kiooAirdrop.claim();
        if (tx === null) {
            warn(tx);
            return _msg('KIOO Airdrop Claim', "Couldn't claim the reward");
        }
    } catch (err) {
        return _msg('KIOO Airdrop Claim', err.reason || err);
    }

    const txReceipt = await tx.wait();
    if (txReceipt == null || txReceipt.status !== 1) {
        return _msg('KIOO Airdrop Claim', "Didn't work, please retry or contact the dev team");
    }

    // additional sleep time to get claim state to be effective on most validator nodes
    await Sleep(2 * 1000);

    await UpdateUI();
};

/* UI Utils */

const _msg = (title, message) => {
    const dialog = $('dialog#msg');
    dialog.find('h2').html(title);
    dialog.find('p').first().html(message);
    // dialog.addClass('show');
    dialog.fadeIn('slow');
};

/* Helpers */

const UserIsEligible = () => {
    if (!UserState.isConnected) {
        return false;
    }

    if (!ContractState.live) {
        return false;
    }

    if (UserState.rewardClaimed) {
        return false;
    }

    if (ContractState.balance === 0n) {
        danger('Contract balance is out of $KIOO!');
        return false;
    }

    if (UserState.kiooBalance > 0) {
        danger('KIOO user balance is not empty!');
        return false;
    }

    return true;
};

const HandleEthereum = () => {
    if (web3MobileHandled) {
        return;
    }
    web3MobileHandled = true;
    const { ethereum } = window;
    if (ethereum && ethereum.isMetaMask) {
        web3Wallet = ethereum;
    }
};

const SetItem = (key, value) => {
    if (window.localStorage) {
        const storage = window.localStorage;
        storage.setItem(key, value);
    }
};

const GetItem = (key) => {
    if (window.localStorage) {
        const storage = window.localStorage;
        return storage.getItem(key);
    }
    return '';
};

const SetSessionItem = (key, value) => {
    if (window.sessionStorage) {
        const sstorage = window.sessionStorage;
        sstorage.setItem(key, value);
    }
};

const GetSessionItem = (key) => {
    if (window.sessionStorage) {
        const sstorage = window.sessionStorage;
        return sstorage.getItem(key);
    }
    return '';
};

const Sleep = async (ms) => {
    return await new Promise(resolve => setTimeout(resolve, ms));
};

const UpdateKiooPriceUsd = async () => {
    // testnet const price
    if (AvaxChainIdHex === ethers.toBeHex(43113)) {
        KiooInUsd.usdPrice = 42.0;
        return;
    }

    if (KiooInUsd.lastTime == 0 || (Date.now() - KiooInUsd.lastTime) > KiooInUsd.RATE_LIMIT_MS) {
        try {
            req = new ethers.FetchRequest(`https://api.dexscreener.com/latest/dex/search?q=${KiooAddress}`);
            resp = await req.send();
            if (!resp.hasBody()) {
                KiooInUsd.usdPrice = 0.0;
                return;
            }

            KiooInUsd.usdPrice = Number.parseFloat(resp.bodyJson.pairs[0].priceUsd);
            KiooInUsd.lastTime = Date.now();
        } catch (error) {
            danger(error);
            KiooInUsd.usdPrice = 0.0;
            return;
        }
    }
};

const PrintBigNumberToShortFormat = (number) => {
    const formatter = Intl.NumberFormat(undefined, { notation: "compact",  maximumFractionDigits: 2  });
    return formatter.format(number);
}
