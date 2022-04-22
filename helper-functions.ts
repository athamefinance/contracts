import { run } from 'hardhat';
import { ethers } from 'ethers';
import { BigNumberish } from '@ethersproject/bignumber';

export const verify = async (contractAddress: string, args: any[]) => {
    console.log('Verifying contract...');
    try {
        await run('verify:verify', {
            address: contractAddress,
            constructorArguments: args,
        })
    } catch (e: any) {
        if (e.message.toLowerCase().includes('already verified')) {
            console.log('Already verified!');
        } else {
            console.log(e);
        }
    }
}

export const toFloat = (value: BigNumberish, decimals: number): number => {
    return parseFloat(ethers.utils.formatUnits(value, decimals));
}

export const chunkArray = (length: number, chunkSize: number) => {
    var begin = -1;
    var results = [];

    for (var i = 0; i < length; i++) {
        if (begin == -1) {
            begin = i;
        }

        if (i % chunkSize == chunkSize - 1)
        {
            results.push([begin, i]);
            begin = -1;
        }
    }

    return results;
}




