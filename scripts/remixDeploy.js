// Right click on the script name and hit "Run" to execute
(async () => {
    try {

        console.log('Deploying with MetaMask default account...');

        const signer = (new ethers.providers.Web3Provider(web3Provider)).getSigner();
        const deployerAddress = await signer.getAddress();
        console.log('accounts...', deployerAddress);

        // SECONDARY ADMIN
        const admin2 = '0x1195dB1bE9c71ACA76eB459776EE399d6F47ac5a';
        // -----------------------------------------------------------------------------------------

        // USDC
        // -----------------------------------------------------------------------------------------
        const usdContractAddress = '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E';
        const usdcDecimals = 6;
        // -----------------------------------------------------------------------------------------

        // TOKEN
        // -----------------------------------------------------------------------------------------
        const tokenAddress = '0x0F707bb0E254868896aea49A3B50fD1ff3252480'; // previously deployed
        // -----------------------------------------------------------------------------------------

        // TREASURY
        // -----------------------------------------------------------------------------------------
        const treasuryContract = await deployContract('AthameTreasury', [], signer);
        // -----------------------------------------------------------------------------------------

        // DEPOSITORY
        // -----------------------------------------------------------------------------------------
        const sharePrice = new ethers.utils.parseUnits('10', usdcDecimals);
        const depositoryConstructorArgs = [treasuryContract.address,
            tokenAddress,
            usdContractAddress,
            deployerAddress,
            sharePrice];
        const depositoryContract = await deployContract('AthameDepository', depositoryConstructorArgs, signer);
        // -----------------------------------------------------------------------------------------

        console.log("Done deploying");

        // -----------------------------------------------------------------------------------------
        console.log("Configuring");
        const depositorRole = await treasuryContract.DEPOSITOR();
        const liquidityRole = await treasuryContract.LIQUIDITYTOKEN();
        const adminRole = await treasuryContract.DEFAULT_ADMIN_ROLE();
    
        // these need to be run before accepting investors
        await treasuryContract.grantRole(liquidityRole, usdContractAddress); // set liquidity token
        await treasuryContract.grantRole(depositorRole, depositoryContract.address); // set depositor
        await treasuryContract.grantRole(adminRole, admin2); // set second admin

        // SET MANUALLY set token minter role to depositoryContract
        // SET MANUALLY set token admin to depositoryContract
        // remove minter role to initial owner
        // remove token admin role to initial owner
        // transferOwnership to depositoryContract 
        await depositoryContract.grantRole(adminRole, admin2); // set second admin
        // SET MANUALLY await depositoryContract.unpause(); // then unpause

        console.log("Done Configuring");

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

async function attachContract(name, address, signer) {

    const artifactsPath = `browser/contracts/artifacts/${name}.json`; // Change this for different path
    const metadata = JSON.parse(await remix.call('fileManager', 'getFile', artifactsPath));

    const factory = new ethers.ContractFactory(metadata.abi, metadata.data.bytecode.object, signer);
    return await factory.attach(address);
}