<template>
  <div v-if="loading" class="w-100">
    <!-- TODO Create better skeletons in the future. -->
    <v-skeleton-loader type="card" />
    <v-skeleton-loader type="card" />
    <v-skeleton-loader type="card" />
  </div>
  <div v-else-if="fund?.address">
    <div class="fund_details">
      <div class="main_card">
        <FundInfo :fund="fund" />
      </div>

      <div class="d-flex flex-column">
        <div class="main_card main_grid order-1 order-sm-0">
          <FundSettlement :fund="fund" />
          <!-- TODO current cycle is work in progress -->
          <!--          <FundCurrentCycle :fund="fund" />-->
        </div>

        <div class="main_card">
          <FundChart :fund="fund" />
        </div>
      </div>

      <FundOverview :fund="fund" />
    </div>
  </div>
  <div v-else class="d-flex flex-column h-100 align-center">
    <h2 class="mb-2">
      Fund not found
    </h2>
    <p class="text-center">
      Are you sure you are on the right network? <br>
      Try switching to a different network.
    </p>
  </div>

</template>

<script lang="ts" setup>
import { useFundStore } from "~/store/fund.store";
import { useWeb3Store } from "~/store/web3.store";
import type IFund from "~/types/fund";

const fundStore = useFundStore();
const web3Store = useWeb3Store();
const route = useRoute();
const loading = ref(true);
const fundAddress = (route.params.id as string).split("-")[1];

onUnmounted(  () => {
  fundStore.fund = { } as IFund;
  fundStore.selectedFundAddress = "";
})

const fetchFund = async () => {
  if (!fundAddress) {
    console.error("No fund address provided in the route.");
    return;
  }
  loading.value = true;

  try {
    await fundStore.getFund(fundAddress);
  } catch (e) {
    console.error("Failed fetching fund -> ", e)
  }

  loading.value = false;
}

watch(() => web3Store.chainId, () => {
  fetchFund();
});

onMounted(  () => {
  fetchFund();
});
const fund = computed(() => fundStore.fund);
</script>

<style lang="scss" scoped>
.fund_details {
  width: 100%;
}
</style>
