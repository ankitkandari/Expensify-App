import React, {useEffect, useRef, useState} from 'react';
import {View} from 'react-native';
import PropTypes from 'prop-types';
import {withOnyx} from 'react-native-onyx';
import lodashGet from 'lodash/get';
import _ from 'underscore';
import CONST from '../../../../CONST';
import ONYXKEYS from '../../../../ONYXKEYS';
import ROUTES from '../../../../ROUTES';
import MoneyRequestParticipantsSelector from './MoneyRequestParticipantsSelector';
import styles from '../../../../styles/styles';
import ScreenWrapper from '../../../../components/ScreenWrapper';
import Navigation from '../../../../libs/Navigation/Navigation';
import * as DeviceCapabilities from '../../../../libs/DeviceCapabilities';
import HeaderWithBackButton from '../../../../components/HeaderWithBackButton';
import * as IOU from '../../../../libs/actions/IOU';
import * as MoneyRequestUtils from '../../../../libs/MoneyRequestUtils';
import {iouPropTypes, iouDefaultProps} from '../../propTypes';
import useLocalize from '../../../../hooks/useLocalize';
import transactionPropTypes from '../../../../components/transactionPropTypes';

const propTypes = {
    /** React Navigation route */
    route: PropTypes.shape({
        /** Params from the route */
        params: PropTypes.shape({
            /** The type of IOU report, i.e. bill, request, send */
            iouType: PropTypes.string,

            /** The report ID of the IOU */
            reportID: PropTypes.string,
        }),
    }).isRequired,

    /** Holds data related to Money Request view state, rather than the underlying Money Request data. */
    iou: iouPropTypes,

    /** The current tab we have navigated to in the request modal. String that corresponds to the request type. */
    selectedTab: PropTypes.oneOf([CONST.TAB.DISTANCE, CONST.TAB.MANUAL, CONST.TAB.SCAN]).isRequired,

    /** Transaction that stores the distance request data */
    transaction: transactionPropTypes,
};

const defaultProps = {
    iou: iouDefaultProps,
    transaction: {},
};

function MoneyRequestParticipantsPage({iou, selectedTab, route, transaction}) {
    const {translate} = useLocalize();
    const prevMoneyRequestId = useRef(iou.id);
    const isNewReportIDSelectedLocally = useRef(false);
    const optionsSelectorRef = useRef();
    const iouType = useRef(lodashGet(route, 'params.iouType', ''));
    const reportID = useRef(lodashGet(route, 'params.reportID', ''));
    const isDistanceRequest = MoneyRequestUtils.isDistanceRequest(iouType.current, selectedTab);
    const isScanRequest = MoneyRequestUtils.isScanRequest(selectedTab);
    const isSplitRequest = iou.id === CONST.IOU.MONEY_REQUEST_TYPE.SPLIT;
    const [headerTitle, setHeaderTitle] = useState();
    const isEmptyWaypoint = _.isEmpty(lodashGet(transaction, 'comment.waypoints.waypoint0', {}));
    useEffect(() => {
        if (isDistanceRequest) {
            setHeaderTitle(translate('common.distance'));
            return;
        }

        setHeaderTitle(_.isEmpty(iou.participants) ? translate('tabSelector.manual') : translate('iou.split'));
    }, [iou.participants, isDistanceRequest, translate]);

    const navigateToRequestStep = (moneyRequestType, option) => {
        if (option.reportID) {
            isNewReportIDSelectedLocally.current = true;
            IOU.setMoneyRequestId(`${moneyRequestType}${option.reportID}`);
            Navigation.navigate(ROUTES.MONEY_REQUEST_CONFIRMATION.getRoute(moneyRequestType, option.reportID));
            return;
        }

        IOU.setMoneyRequestId(moneyRequestType);
        Navigation.navigate(ROUTES.MONEY_REQUEST_CONFIRMATION.getRoute(moneyRequestType, reportID.current));
    };

    const navigateToSplitStep = (moneyRequestType) => {
        IOU.setMoneyRequestId(moneyRequestType);
        Navigation.navigate(ROUTES.MONEY_REQUEST_CONFIRMATION.getRoute(moneyRequestType, reportID.current));
    };

    const navigateBack = (forceFallback = false) => {
        Navigation.goBack(ROUTES.MONEY_REQUEST.getRoute(iouType.current, reportID.current), forceFallback);
    };

    useEffect(() => {
        const isInvalidDistanceRequest = !isDistanceRequest || isEmptyWaypoint;

        // ID in Onyx could change by initiating a new request in a separate browser tab or completing a request
        if (prevMoneyRequestId.current !== iou.id) {
            // The ID is cleared on completing a request. In that case, we will do nothing
            if (iou.id && isInvalidDistanceRequest && !isSplitRequest && !isNewReportIDSelectedLocally.current) {
                navigateBack(true);
            }
            return;
        }

        // Reset the money request Onyx if the ID in Onyx does not match the ID from params
        const moneyRequestId = `${iouType.current}${reportID.current}`;
        const shouldReset = iou.id !== moneyRequestId && !isNewReportIDSelectedLocally.current;
        if (shouldReset) {
            IOU.resetMoneyRequestInfo(moneyRequestId);
        }
        if (isInvalidDistanceRequest && ((iou.amount === 0 && !iou.receiptPath) || shouldReset)) {
            navigateBack(true);
        }

        return () => {
            prevMoneyRequestId.current = iou.id;
        };
    }, [iou.amount, iou.id, iou.receiptPath, isDistanceRequest, isSplitRequest, isEmptyWaypoint]);

    return (
        <ScreenWrapper
            includeSafeAreaPaddingBottom={false}
            shouldEnableMaxHeight={DeviceCapabilities.canUseTouchScreen()}
            onEntryTransitionEnd={() => optionsSelectorRef.current && optionsSelectorRef.current.focus()}
            testID={MoneyRequestParticipantsPage.displayName}
        >
            {({safeAreaPaddingBottomStyle}) => (
                <View style={styles.flex1}>
                    <HeaderWithBackButton
                        title={headerTitle}
                        onBackButtonPress={navigateBack}
                    />
                    <MoneyRequestParticipantsSelector
                        ref={(el) => (optionsSelectorRef.current = el)}
                        participants={iou.participants}
                        onAddParticipants={IOU.setMoneyRequestParticipants}
                        navigateToRequest={(option) => navigateToRequestStep(CONST.IOU.MONEY_REQUEST_TYPE.REQUEST, option)}
                        navigateToSplit={() => navigateToSplitStep(CONST.IOU.MONEY_REQUEST_TYPE.SPLIT)}
                        safeAreaPaddingBottomStyle={safeAreaPaddingBottomStyle}
                        iouType={iouType.current}
                        isDistanceRequest={isDistanceRequest}
                        isScanRequest={isScanRequest}
                    />
                </View>
            )}
        </ScreenWrapper>
    );
}

MoneyRequestParticipantsPage.displayName = 'IOUParticipantsPage';
MoneyRequestParticipantsPage.propTypes = propTypes;
MoneyRequestParticipantsPage.defaultProps = defaultProps;

export default withOnyx({
    iou: {
        key: ONYXKEYS.IOU,
    },
    selectedTab: {
        key: `${ONYXKEYS.COLLECTION.SELECTED_TAB}${CONST.TAB.RECEIPT_TAB_ID}`,
    },
    transaction: {
        key: ({iou}) => `${ONYXKEYS.COLLECTION.TRANSACTION}${iou ? iou.transactionID : ''}`,
    },
})(MoneyRequestParticipantsPage);
