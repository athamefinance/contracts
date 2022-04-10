// Right click on the script name and hit "Run" to execute
(async () => {
    try {
        console.log('Deploying with MetaMask default account...');

        const signer = (new ethers.providers.Web3Provider(web3Provider)).getSigner();
        const deployerAddress = await signer.getAddress();
        console.log('accounts...', deployerAddress);

        // USDC
        // -----------------------------------------------------------------------------------------
        const usdContract = await deployContract('Usd', [], signer);
        // -----------------------------------------------------------------------------------------

        // TOKEN
        // -----------------------------------------------------------------------------------------
        const tokenContract = await deployContract('AthameToken', [], signer);
        // -----------------------------------------------------------------------------------------

        // TREASURY
        // -----------------------------------------------------------------------------------------
        const treasuryContract = await deployContract('AthameTreasury', [], signer);
        // -----------------------------------------------------------------------------------------

        // DEPOSITORY
        // -----------------------------------------------------------------------------------------
        const decimals = await usdContract.decimals();
        const sharePrice = new ethers.utils.parseUnits('10', decimals);
        const depositoryConstructorArgs = [treasuryContract.address,
        tokenContract.address,
        usdContract.address,
            deployerAddress,
            sharePrice];
        await deployContract('AthameDepository', depositoryConstructorArgs, signer);
        // -----------------------------------------------------------------------------------------

        console.log("Done deploying");

    } catch (e) {
        console.log(e.message);
    }
})();

async function deployContract(name, args, signer) {

    const artifactsPath = `browser/contracts/artifacts/${name}.json`; // Change this for different path
    const metadata = JSON.parse(await remix.call('fileManager', 'getFile', artifactsPath));

    const factory = new ethers.ContractFactory(metadata.abi, metadata.data.bytecode.object, signer);
    const contract = await factory.deploy(...args);
    await contract.deployed();
    console.log(`${name} Contract deployed at address: `, contract.address);

    return contract;
}