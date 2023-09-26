import React, {useEffect, useRef} from 'react';
import lodashGet from 'lodash/get';
import PropTypes from 'prop-types';
import _ from 'underscore';
import {withOnyx} from 'react-native-onyx';
import ONYXKEYS from '../ONYXKEYS';
import CONST from '../CONST';
import ScreenWrapper from '../components/ScreenWrapper';
import HeaderWithBackButton from '../components/HeaderWithBackButton';
import Navigation from '../libs/Navigation/Navigation';
import useLocalize from '../hooks/useLocalize';
import DistanceRequest from '../components/DistanceRequest';
import reportPropTypes from './reportPropTypes';
import * as IOU from '../libs/actions/IOU';
import transactionPropTypes from '../components/transactionPropTypes';
import * as TransactionEdit from '../libs/actions/TransactionEdit';
import useNetwork from '../hooks/useNetwork';
import usePrevious from '../hooks/usePrevious';

const propTypes = {
    /** The transactionID we're currently editing */
    transactionID: PropTypes.string.isRequired,

    /** The report to with which the distance request is associated */
    report: reportPropTypes.isRequired,

    /** Passed from the navigator */
    route: PropTypes.shape({
        /** Parameters the route gets */
        params: PropTypes.shape({
            /** Type of IOU */
            iouType: PropTypes.oneOf(_.values(CONST.IOU.MONEY_REQUEST_TYPE)),

            /** Id of the report on which the distance request is being created */
            reportID: PropTypes.string,
        }),
    }).isRequired,

    /* Onyx props */
    /** The original transaction that is being edited */
    transaction: transactionPropTypes,
};

const defaultProps = {
    transaction: {},
};

function EditRequestDistancePage({report, route, transaction}) {
    const {isOffline} = useNetwork();
    const {translate} = useLocalize();
    const transactionWasSaved = useRef(false);
    const hasWaypointError = useRef(false);
    const prevIsLoading = usePrevious(transaction.isLoading);

    useEffect(() => {
        hasWaypointError.current = Boolean(lodashGet(transaction, 'errorFields.route') || lodashGet(transaction, 'errorFields.waypoints'));

        // When the loading goes from true to false, then we know the transaction has just been
        // saved to the server. Check for errors. If there are no errors, then the modal can be closed.
        if (prevIsLoading && !transaction.isLoading && !hasWaypointError.current) {
            Navigation.dismissModal(report.reportID);
        }
    }, [transaction, prevIsLoading]);

    useEffect(() => {
        // This effect runs when the component is mounted and unmounted. It's purpose is to be able to properly
        // discard changes if the user cancels out of making any changes. This is accomplished by backing up the
        // original transaction, letting the user modify the current transaction, and then if the user ever
        // cancels out of the modal without saving changes, the original transaction is restored from the backup.

        // On mount, create the backup transaction.
        TransactionEdit.createBackupTransaction(transaction);

        return () => {
            // Unmounting happens when:
            // 1. The transaction was saved offline or with no server errors
            // 2. The user cancels out of the modal

            // If 1 happened, then only the backup transaction needs to be removed because it is no longer needed
            if (transactionWasSaved.current && !hasWaypointError.current) {
                TransactionEdit.removeBackupTransaction(transaction.transactionID);
                return;
            }

            // If 2 happened, then the original transaction needs to be restored so that no user changes are stored to onyx permanently.
            // This also also deletes the backup.
            TransactionEdit.restoreOriginalTransactionFromBackup(transaction.transactionID);

            // You might be asking yourself "What about the case where the user saves the transaction, but there are server errors?"
            // When this happens, the modal remains open so the user can fix the errors. Therefore, this component is never unmounted and this
            // logic doesn't run. Once the user fixes the errors, they can:
            // - Cancel out of the modal (triggering flow 2 above)
            // - Fix the errors and save the transaction (triggering flow 1 above)
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * Save the changes to the original transaction object
     * @param {Object} waypoints
     */
    const saveTransaction = (waypoints) => {
        transactionWasSaved.current = true;
        IOU.updateDistanceRequest(transaction.transactionID, report.reportID, {waypoints});

        // If the client is offline, then the modal can be closed as well (because there are no errors or other feedback to show them
        // until they come online again and sync with the server).
        if (isOffline) {
            Navigation.dismissModal(report.reportID);
        }
    };

    return (
        <ScreenWrapper
            includeSafeAreaPaddingBottom={false}
            shouldEnableMaxHeight
        >
            <HeaderWithBackButton
                title={translate('common.distance')}
                onBackButtonPress={() => Navigation.goBack()}
            />
            <DistanceRequest
                report={report}
                route={route}
                transactionID={transaction.transactionID}
                onSubmit={saveTransaction}
                isEditingRequest
            />
        </ScreenWrapper>
    );
}

EditRequestDistancePage.propTypes = propTypes;
EditRequestDistancePage.defaultProps = defaultProps;
EditRequestDistancePage.displayName = 'EditRequestDistancePage';
export default withOnyx({
    transaction: {
        key: (props) => `${ONYXKEYS.COLLECTION.TRANSACTION}${props.transactionID}`,
    },
})(EditRequestDistancePage);
