// Right click on the script name and hit "Run" to execute
(async () => {
    try {
        console.log('Deploying with MetaMask default account...');

        const signer = (new ethers.providers.Web3Provider(web3Provider)).getSigner();
        const deployerAddress = await signer.getAddress();
        console.log('accounts...', deployerAddress);

        // TOKEN
        // -----------------------------------------------------------------------------------------
        await deployContract('AthameToken', [], signer);
        // -----------------------------------------------------------------------------------------



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