import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../../constants";

const deployAthameTreasury: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { getNamedAccounts, deployments } = hre;
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();

    log("----------------------------------------------------");
    log("Deploying Athame Treasury and waiting for confirmations...");

    const result = await deploy(CONTRACTS.treasury, {
        from: deployer,
        args: [],
        log: true,
        // we need to wait if on a live network so we can verify properly
        waitConfirmations: 1
    });

    log(`Athame Treasury at ${result.address}`);

};

export default deployAthameTreasury;
deployAthameTreasury.tags = [CONTRACTS.treasury, "all"];