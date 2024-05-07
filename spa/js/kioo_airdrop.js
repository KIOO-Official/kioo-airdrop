class KiooAirdrop {
    #signer = null;
    #airdropContractAddr = null;
    #CONTRACT = null;

    #ABI = [
        'function _tokenAirdropped() view returns (address)',
        'function airdropLive() view returns (bool)',
        'function balance() view returns (uint256)',
        'function claimed(address account) view returns (bool)',
        'function dropAmount() view returns (uint256)',
        'function owner() view returns (address)',

        'function airdrop()',
        'function deposit(uint256 amount)',
    ];

    constructor(airdropContractAddr, signer) {
        this.#airdropContractAddr = airdropContractAddr;
        this.#signer = signer;
        this.#CONTRACT = new ethers.Contract(this.#airdropContractAddr, this.#ABI, this.#signer);
    }

    /* Read state */

    async tokenAirdropped() {
        return await this.#CONTRACT._tokenAirdropped();
    }

    async airdropLive() {
        return await this.#CONTRACT.airdropLive();
    }

    async balance() {
        return await this.#CONTRACT.balance();
    }

    async claimed(account) {
        return await this.#CONTRACT.claimed(account);
    }

    async dropAmount() {
        return await this.#CONTRACT.dropAmount();
    }

    async owner() {
        return await this.#CONTRACT.owner();
    }

    /* Write state (TXs) */

    async airdrop() {
        let estimateGas = await this.#CONTRACT.airdrop.estimateGas();
        if (typeof estimateGas !== 'bigint') {
            throw "couldn't estimate gas for contract.airdrop/claim";
        }

        return await this.#CONTRACT.airdrop({ gasLimit: estimateGas });
    }
    async claim() {
        return this.airdrop();
    }

    async deposit(amount) {
        let estimateGas = await this.#CONTRACT.deposit.estimateGas(amount);
        if (typeof estimateGas !== 'bigint') {
            throw "couldn't estimate gas for contract.deposit";
        }
        return await this.#CONTRACT.deposit(amount, { gasLimit: estimateGas });
    }
}