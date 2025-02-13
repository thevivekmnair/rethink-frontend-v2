<template>
  <FundSettlementBaseForm
    v-if="fund"
    v-model="tokenValue"
    :token0="fund.fundToken"
    :token1="fund.baseToken"
    :token0-user-balance="fundStore.userFundTokenBalance"
    :token1-user-balance="fundStore.userBaseTokenBalance"
    :exchange-rate="fundStore.fundToBaseTokenExchangeRate"
  >
    <template #buttons>
      <div v-if="accountStore.isConnected">
        <div class="deposit_button_group">
          <v-tooltip
            v-for="(button, index) in buttons"
            :key="index"
            :disabled="!button.tooltipText"
            bottom
          >
            <template #default>
              {{ button.tooltipText }}
            </template>
            <template #activator="{ props }">
              <!-- Wrap it in the span to show the tooltip even if the button is disabled. -->
              <span v-bind="props">
                <v-btn
                  class="bg-primary text-secondary"
                  :disabled="button.disabled"
                  @click="button.onClick"
                >
                  <template #prepend>
                    <v-progress-circular
                      v-if="button.loading"
                      class="d-flex"
                      size="20"
                      width="3"
                      indeterminate
                    />
                  </template>
                  {{ button.name }}
                </v-btn>
              </span>
            </template>
          </v-tooltip>

        </div>
        <div v-if="visibleErrorMessages && tokenValueChanged" class="text-red mt-4 text-center">
          <div v-for="(error, index) in visibleErrorMessages" :key="index">
            {{ error.message }}
          </div>
        </div>
      </div>
      <template v-else>
        <v-btn class="bg-primary text-secondary" @click="accountStore.connectWallet()">
          Connect Wallet
        </v-btn>
      </template>
    </template>
  </FundSettlementBaseForm>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import { computed, ref } from "vue";
import { useAccountStore } from "~/store/account.store";
import { useFundStore } from "~/store/fund.store";
import { useToastStore } from "~/store/toast.store";

const toastStore = useToastStore();
const accountStore = useAccountStore();
const fundStore = useFundStore();
const tokenValue = ref("0.0");
const tokenValueChanged = ref(false);
const fund = computed(() => fundStore.fund);

const loadingRequestRedeem = ref(false);
const loadingCancelRedeem = ref(false);
const loadingRedeem = ref(false);

watch(() => tokenValue.value, () => {
  tokenValueChanged.value = true;
});

interface IError {
  message: string,
  display: boolean,
}
const rules = [
  (value: string): boolean | IError => {
    if (!fund.value) return { message: "Fund data is missing.", display: true }
    const valueWei = ethers.parseUnits(value, fund.value?.baseToken.decimals);
    if (valueWei <= 0) return { message: "Value must be positive.", display: false }

    console.log("[REDEEM] check user fund token balance wei: ", valueWei, fundStore.userFundTokenBalance);
    if (fundStore.userFundTokenBalance < valueWei) {
      const userFundTokenBalanceFormatted = formatTokenValue(fundStore.userFundTokenBalance, fund.value.fundToken.decimals);
      return {
        message: `Your ${fund.value.fundToken.symbol} balance is too low: ${userFundTokenBalanceFormatted}.`,
        display: true,
      }
    }
    return true;
  },
];

const isAnythingLoading = computed(() => {
  // Object.values returns an array of values from the actions object
  // some() checks if at least one element passes the test implemented by the provided function
  return (loadingRequestRedeem.value || loadingCancelRedeem.value || loadingRedeem.value);
});

const isRedeemDisabled = computed(() => {
  // Disable deposit button if any of rules is false.
  return errorMessages.value.length > 0 || isAnythingLoading.value;
});

const errorMessages = computed<IError[]>(() => {
  // Disable Redeem button if any of rules is false.
  return rules.map(rule => rule(tokenValue.value)).filter(rule => rule !== true) as IError[];
});
const visibleErrorMessages = computed<IError[]>( () => {
  return errorMessages.value.filter((error: IError) => error.display)
})

const handleError = (error: any) => {
  // Check Metamask errors:
  // https://github.com/MetaMask/rpc-errors/blob/main/src/error-constants.ts
  if (error?.code === 4001) {
    toastStore.addToast("Redeem transaction was rejected.")
  } else {
    toastStore.errorToast("There has been an error. Please contact the Rethink Finance support.");
    console.error(error);
  }
  loadingRequestRedeem.value = false;
  loadingCancelRedeem.value = false;
  loadingRedeem.value = false;
}


const requestRedeem = async () => {
  if (!accountStore.activeAccount?.address) {
    toastStore.errorToast("Connect your wallet to redeem tokens from the fund.")
    return;
  }
  if (!fund.value) {
    toastStore.errorToast("Fund data is missing.")
    return;
  }
  console.log("[REQUEST REDEEM]");
  loadingRequestRedeem.value = true;

  const tokensWei = ethers.parseUnits(tokenValue.value, fund.value.fundToken.decimals)
  console.log("[REDEEM] tokensWei: ", tokensWei, "from : ", accountStore.activeAccount.address);
  try {
    await fundStore.fundContract.methods.requestWithdraw(tokensWei).send({
      from: accountStore.activeAccount.address,
      maxPriorityFeePerGas: null,
      maxFeePerGas: null,
    }).on("transactionHash", (hash: string) => {
      console.log("tx hash: " + hash);
      toastStore.addToast("The transaction has been submitted. Please wait for it to be confirmed.");

    }).on("receipt", (receipt: any) => {
      console.log(receipt);

      if (receipt.status) {
        toastStore.successToast(
          "Your withdrawal request was successful. It may take 10 seconds or more for values to update.",
        );
        tokenValue.value = "0.0";
      } else {
        toastStore.errorToast("The transaction has failed. Please contact the Rethink Finance support.");
      }

      loadingRequestRedeem.value = false;
    }).on("error", (error: any) => {
      handleError(error);
    });
  } catch (error: any) {
    handleError(error);
  }
}

const redeem = async () => {
  if (!accountStore.activeAccount?.address) {
    toastStore.errorToast("Connect your wallet to redeem tokens from the fund.")
    return;
  }
  if (!fund.value) {
    toastStore.errorToast("Fund data is missing.")
    return;
  }
  console.log("[REDEEM]");
  loadingRedeem.value = true;

  const tokensWei = ethers.parseUnits(tokenValue.value, fund.value.fundToken.decimals)
  console.log("[REDEEM] tokensWei: ", tokensWei, "from : ", accountStore.activeAccount.address);

  try {
    await fundStore.fundContract.methods.withdraw().send({
      from: accountStore.activeAccount.address,
      maxPriorityFeePerGas: null,
      maxFeePerGas: null,
    }).on("transactionHash", (hash: string) => {
      console.log("tx hash: " + hash);
      toastStore.addToast("The transaction has been submitted. Please wait for it to be confirmed.");

    }).on("receipt", (receipt: any) => {
      console.log("receipt: ", receipt);

      if (receipt.status) {
        toastStore.successToast(
          "Your withdrawal was successful. It may take 10 seconds or more for values to update.",
        );

        // Refresh user balances & allowance.
        fundStore.fetchUserBalances();
        tokenValue.value = "0.0";
      } else {
        toastStore.errorToast("The transaction has failed. Please contact the Rethink Finance support.");
      }

      loadingRedeem.value = false;
    }).on("error", (error: any) => {
      handleError(error);
    });
  } catch (error: any) {
    handleError(error);
  }
}


const cancelRedeem = async () => {
  if (!accountStore.activeAccount?.address) {
    toastStore.errorToast("Connect your wallet to cancel an ongoing redeem.")
    return;
  }
  if (!fund.value) {
    toastStore.errorToast("Fund data is missing.")
    return;
  }
  loadingCancelRedeem.value = true;
  console.log("[CANCEL REDEEM] from : ", accountStore.activeAccount.address);

  try {
    await fundStore.fundContract.methods.revokeDepositWithrawal().send({
      from: accountStore.activeAccount.address,
      maxPriorityFeePerGas: null,
      maxFeePerGas: null,
    }).on("transactionHash", (hash: string) => {
      console.log("tx hash: " + hash);
      toastStore.addToast("The transaction has been submitted. Please wait for it to be confirmed.");

    }).on("receipt", (receipt: any) => {
      console.log("receipt: ", receipt);

      if (receipt.status) {
        toastStore.successToast(
          "Withdrawal cancellation was successful. It may take 10 seconds or more for values to update.",
        );

        tokenValue.value = "0.0";
      } else {
        toastStore.errorToast("The transaction has failed. Please contact the Rethink Finance support.");
      }

      loadingCancelRedeem.value = false;
    }).on("error", (error: any) => {
      handleError(error);
    });
  } catch (error: any) {
    handleError(error);
  }
}


const buttons = ref([
  {
    name: "Request Redeem",
    onClick: requestRedeem,
    disabled: isRedeemDisabled,
    loading: loadingRequestRedeem,
    tooltipText: undefined,
  },
  {
    name: "Cancel Redeem",
    onClick: cancelRedeem,
    disabled: isAnythingLoading,
    loading: loadingCancelRedeem,
    tooltipText: undefined,
  },
  {
    name: "Redeem",
    onClick: redeem,
    disabled: isRedeemDisabled,
    loading: loadingRedeem,
    tooltipText: undefined,
  },
]);
</script>

<style lang="scss" scoped>
.deposit_button_group {
  gap: 1rem;
  display: flex;
  justify-content: space-around;
  flex-wrap: wrap;
}
</style>
